var logger;
var dataProvider;

function setup(app, logger_, originChecker, jsonParser, dataProvider_) {
    logger = logger_;
    dataProvider = dataProvider_;
    logger.info('Initalizing definitions endpoint');

    app.post('/endpoint/definitions', originChecker, jsonParser, (req, res) => {
        if (!req.body || !req.body.type || typeof(req.body.type) !== 'string') {
            res.status(400).end('Bad Request');
            return;
        }

        fetchDefinitions(req.body.type, req.body.mode, res);
    });

    app.post('/endpoint/holidays', originChecker, (req, res) => {
        res.json(dataProvider.getHolidays());
    });

    app.post('/endpoint/lastimport', originChecker, (req, res) => {
        res.json(dataProvider.getLastUntisUpdateTime());
    });
}

function fetchDefinitions(type, mode, res) {
    if (type === 'classes') {
        res.json(dataProvider.getClasses(mode)).end();
    } else if (type === 'rooms') {
        res.json(dataProvider.getRooms(mode)).end();
    } else if (type === 'teachers') {
        res.json(dataProvider.getTeachers(mode)).end();
    } else if (type === 'subjects') {
        res.json(dataProvider.getSubjects(mode)).end();
    } else if (type === 'all') {
        res.json(dataProvider.getAll(mode)).end();
    } else res.status(400).end('Bad Request');
}

module.exports = setup;