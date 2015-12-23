'use strict';

const mysql   = require('anytv-node-mysql');
const winston = require('winston');
const async   = require('async');
const AWS 	  = require('aws-sdk');
const regions = [
		'us-east-1',
		'us-west-2',
		'us-west-1',
		'eu-west-1',
		'eu-central-1',
		'ap-southeast-1',
		'ap-southeast-2',
		'ap-northeast-1',
		'sa-east-1'
	];


exports.get_instances = (region, next) => {
	let requests = {};

	function start() {
		if (region) {
			let ec2 = new AWS.EC2({
					apiVersion: '2015-10-01',
					region: region
				});

			requests[region] = function (callback) {
				ec2.describeInstances({}, format_data);
			}
		} else {
			regions.forEach(function (region) {
				let ec2 = new AWS.EC2({
						apiVersion: '2015-10-01',
						region: region
					});

				requests[region] = function (callback) {
					ec2.describeInstances({}, callback);
				};
			});
		}

		async.parallel(requests, format_data);
	}

	function format_data(err, result) {
		let return_data = [];

		if (err) {
			return next(err);
		}

		for(let i in result) {
			result[i].Reservations.forEach(function (reservation) {
				reservation.Instances.forEach(function (instance) {
					if (instance.State.Code != 16) {
						return;
					}
					instance.Region = i;
					return_data.push(instance);
				});
			});
		}

		next(null, return_data);
	}


	start();
}

exports.get_graphs = (instance_id, region, next) => {
	let requests = {};

	function start() {
		let start = new Date();
		let cloudwatch = new AWS.CloudWatch({
			region: region
		});

		start.setMinutes(start.getMinutes() - 30);

		requests['CPUUtilization'] = function (callback) {
			cloudwatch.getMetricStatistics({
				StartTime: start,
				EndTime: new Date,
				MetricName: 'CPUUtilization',
				Namespace: 'AWS/EC2',
				Period: 300,
				Statistics: [
					'Average'
				],
				Dimensions: [{
					Name: 'InstanceId',
					Value: instance_id
				}]
			}, callback);
		};

		requests['NetworkIn'] = function (callback) {
			cloudwatch.getMetricStatistics({
				StartTime: start,
				EndTime: new Date,
				MetricName: 'NetworkIn',
				Namespace: 'AWS/EC2',
				Period: 300,
				Statistics: [
					'Average'
				],
				Dimensions: [{
					Name: 'InstanceId',
					Value: instance_id
				}]
			}, callback);
		};

		requests['NetworkOut'] = function (callback) {
			cloudwatch.getMetricStatistics({
				StartTime: start,
				EndTime: new Date,
				MetricName: 'NetworkOut',
				Namespace: 'AWS/EC2',
				Period: 300,
				Statistics: [
					'Average'
				],
				Dimensions: [{
					Name: 'InstanceId',
					Value: instance_id
				}]
			}, callback);
		};

		async.parallel(requests, format_data);
	}
 
	function format_data(err, result) {
		if (err) {
			return next(err);
		}

		for (let i in result) {
			result[i] = result[i].Datapoints;
		}

		next(null, result);
	}

	start();
}