'use strict';

const mysql   = require('anytv-node-mysql');
const async   = require('async');
const _       = require('lodash');
const cudl    = require('cuddle');
const winston = require('winston');
const AWS     = require('aws-sdk');
const Aws     = require(__dirname + '/../models/aws');
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


exports.get_instances = (req, res, next) => {
    
    function start() {
        Aws.get_instances(req.query.region, send_response);
    }

    function send_response(err, result) {
        if (err) {
            return next(err);
        }

        res.send(result);
    }

    start();
}

exports.get_disks = (req, res, next) => {

    function start() {
        Aws.get_disks(req.params.instance_id, req.params.region, send_response)
    }

    function send_response(err, result) {
        if (err || !result.Volumes || !result.Volumes.length) {
            return next(err || 'No attachments found');
        }

        res.send(result.Volumes);
    }

    start();
}

exports.get_price = (req, res, next) => {

    function start() {
        cudl.get
            .to('http://a0.awsstatic.com/pricing/1/ec2/linux-od.min.js')
            .then(send_response);
    }

    function send_response(err, result) {
        if (err) {
            return next(err);
        }

        res.send(result);
    }

    start();
}

exports.get_ebsprice = (req, res, next) => {

    function start() {
        cudl.get
            .to('https://a0.awsstatic.com/pricing/1/ebs/pricing-ebs.min.js')
            .then(send_response);
    }

    function send_response(err, result) {
        if (err) {
            return next(err);
        }

        if (req.query.callbacked) {
            result = result.replace('callback(', req.query.callbacked+'(');
        }

        res.send(result);
    }

    start();
}

exports.get_graphs = (req, res, next) => {
    
    function start() {
        Aws.get_graphs(req.params.instance_id, req.params.region, send_response);
    }

    function send_response(err, result) {
        if (err) {
            return next(err);
        }

        res.send(result);
    }

    start();
}

exports.get_index_graph = (req, res, next) => {
    const requests = {};
    const desc_requests =[];

    let _async = regions.length;
    let data = [];
    let instances = {};

    function start() {
        regions.forEach(function (region) {
            let ec2 = new AWS.EC2({
                    apiVersion: '2015-10-01',
                    region: region
                }),
                cloudwatch = new AWS.CloudWatch({
                    region: region
                }),
                _get_instances = get_instances.bind(undefined, cloudwatch);

            ec2.describeInstances({}, _get_instances);
        });
    }

    function get_instances(cloudwatch, err, result) {
        if (err) {
            winston.error('error getting instances', err);
            return next(err);
        }

        result.Reservations.forEach(function (reservation) {
            reservation.Instances.forEach(function (instance) {
                var start = new Date();
                start.setMonth(start.getMonth() - 1);
                
                if (instance.State.Code != 16) {
                    return;
                }

                instances[instance.InstanceId] = instance;

                requests[instance.InstanceId+'--CPUUtilization'] = function (callback) {
                    cloudwatch.getMetricStatistics({
                        StartTime: start,
                        EndTime: new Date,
                        MetricName: 'CPUUtilization',
                        Namespace: 'AWS/EC2',
                        Period: 60*60*24,
                        Statistics: [
                            'Average'
                        ],
                        Dimensions: [{
                            Name: 'InstanceId',
                            Value: instance.InstanceId
                        }]
                    }, callback);
                };

                requests[instance.InstanceId+'--NetworkIn'] = function (callback) {
                    cloudwatch.getMetricStatistics({
                        StartTime: start,
                        EndTime: new Date,
                        MetricName: 'NetworkIn',
                        Namespace: 'AWS/EC2',
                        Period: 60*60*24,
                        Statistics: [
                            'Average'
                        ],
                        Dimensions: [{
                            Name: 'InstanceId',
                            Value: instance.InstanceId
                        }]
                    }, callback);
                };

                requests[instance.InstanceId+'--NetworkOut'] = function (callback) {
                    cloudwatch.getMetricStatistics({
                        StartTime: start,
                        EndTime: new Date,
                        MetricName: 'NetworkOut',
                        Namespace: 'AWS/EC2',
                        Period: 60*60*24,
                        Statistics: [
                            'Average'
                        ],
                        Dimensions: [{
                            Name: 'InstanceId',
                            Value: instance.InstanceId
                        }]
                    }, callback);
                };
            });
        });

        async.parallel(requests, send_response);
    }

    function _flatten(data) {
        let return_val = {};

        data.forEach(function (datum) {
            for (let i in datum) {
                return_val[i] = datum[i];
            }
        });

        return return_val;
    }

    function send_response(err, result) {
        let send_values = {};

        data.push(result);
        if (!--_async) {
            data = _flatten(data);

            for (var i in data) {
                let instance = i.split('--');

                if (!send_values[instance[0]]) {
                    send_values[instance[0]] = {
                        instance: instances[instance[0]]
                    };
                }

                if (!send_values[instance[0]][instance[1]]) {
                    send_values[instance[0]][instance[1]] = [];
                }

                send_values[instance[0]][instance[1]] = data[i].Datapoints;
            }

            x = send_values;
            res.send(send_values);
        }
    }

    return start();
}