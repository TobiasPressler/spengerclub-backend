var logger;
var dataProvider;

function setup(app, logger_, originChecker, jsonParser, dataProvider_) {
    logger = logger_;
    dataProvider = dataProvider_;
    logger.info('Initalizing timetable endpoint');

    app.post('/endpoint/timetable', originChecker, jsonParser, (req, res) => {
        if (!req.body || !req.body.type || !req.body.id || typeof(req.body.type) !== 'number' || typeof(req.body.id) !== 'number' || typeof(req.body.nextWeek) !== 'boolean') {
            res.status(400).end('Bad Request');
            return;
        }

        dataProvider.loadTimetable(req.body.id, req.body.type, req.body.nextWeek, req.body.threedee, (data) => {
            res.json(data).end();
        });
    });

    app.post('/endpoint/currentlesson', originChecker, jsonParser, (req, res) => {
        res.json(dataProvider.getCurrentLesson()).end();
    });
}

module.exports = setup;