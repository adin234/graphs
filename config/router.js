'use strict';

const config   = require(__dirname + '/config');
const importer = require('anytv-node-importer');
const upload   = require('multer')({dest: config.UPLOAD_DIR});

module.exports = (router) => {
    const __ = importer.dirloadSync(__dirname + '/../controllers');

    router.del = router.delete;

    router.get('/data', __.index.get_index_graph);
    router.get('/instances', __.index.get_instances);
    router.get('/instances/:region/:instance_id/graphs', __.index.get_graphs);
    router.get('/prices', __.index.get_price);

    router.all('*', (req, res) => {
        res.status(404)
            .send({message: 'Nothing to do here.'});
    });

    return router;
};
