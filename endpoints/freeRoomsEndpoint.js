var logger;
var dataProvider;

var freeRooms = {};

const blackList = ['AH.21', 'A1.03', 'VAS', 'HOF', 'BLA', 'C1', 'BH', 'WAKL', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'C4', 'C5', 'A1', 'A2', 'A3', 'A4', 'HOF1', 'AU.04', 'BH.10'];

function setup(app, logger_, originChecker, jsonParser, dataProvider_) {
    logger = logger_;
    dataProvider = dataProvider_;
    logger.info('Initalizing free rooms endpoint');

    setTimeout(start, 1000 * 2);
    setInterval(start, 1000 * 60);

    app.post('/endpoint/freerooms', originChecker, (req, res) => {
        res.json(freeRooms).end();
    });
}

function start() {
    const timeUnits = dataProvider.getTimeunits();
    const rooms = dataProvider.getRooms('byName');
    const roomTimetables = [];
    const roomNames = Object.keys(rooms);

    var date = new Date();

    if (date.getDay() == 6) {
        // saturday
        date.setDate(date.getDate() + 2);
        date.setHours(8);
        date.setMinutes(0);
    } else if (date.getDay() == 5 && date.getHours() >= 18) {
        // friday >= 18:00
        date.setDate(date.getDate() + 3);
        date.setHours(8);
        date.setMinutes(0);
    } else if (date.getDay() == 0 || date.getHours() >= 18) {
        // mo, tu, we, thu >= 18:00 or su
        date.setDate(date.getDate() + 1);
        date.setHours(8);
        date.setMinutes(0);
    }
    else if (date.getHours() < 8) {
        // < 8:00
        date.setHours(8);
        date.setMinutes(0);
    }

    const fn = (index, cb) => {
        dataProvider.fetchTimetableDay(rooms[roomNames[index]].id, 4, date, (data) => {
            cb(index, data);
        });
    }

    var bl = 0;

    for (var i = 0; i < roomNames.length; i++) {
        if (blackList.indexOf(roomNames[i]) !== -1 || roomNames[i][0] == 'D' || roomNames[i].length < 5 ||
            roomNames[i].startsWith('BH') || roomNames[i].startsWith('B1') || roomNames[i].startsWith('B2') ||
            roomNames[i].startsWith('B3') || roomNames[i].startsWith('B4')) {
            bl++;
            continue;
        }

        fn(i, (index, data) => {
            if (!data) return;

            const newObj = new Object();
            newObj[roomNames[index]] = data;
            roomTimetables.push(newObj);

            if (roomTimetables.length === (roomNames.length - bl)) {
                findFreeRooms(date, rooms, timeUnits, roomTimetables);
            }
        });
    }
}

function findFreeRooms(date, rooms, timeUnits, roomTimetables) {
    const maxLesson = timeUnits.length;
    var data = findLessonData(date, timeUnits);

    if(!data){
        var data = findLessonData(new Date(date.getTime() + 16*60000), timeUnits);
        if(!data) return;
    }
    
    currLesson = data.currLesson;
    nextLesson = data.nextLesson;
        

    const freeRoomsCurr = [];
    const freeRoomsNext = [];

    for (var i = 0; i < roomTimetables.length; i++) {
        var currTT_ = roomTimetables[i];
        var currRoom = Object.keys(currTT_)[0];
        var currTT = currTT_[currRoom];

        for (var j = 0; j < timeUnits.length; j++) {
            const curr = timeUnits[j];

            var found = false;
            for (var t = 0; t < currTT.length; t++) {
                if (currTT[t].startTime == curr.startTime) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                currTT.push({ startTime: curr.startTime, endTime: curr.endTime, code: 'cancelled' });
            }
        }

        currTT.sort((a, b) => a.startTime - b.startTime);

        for (var d = currTT.length - 1; d >= 0; d--) {
            if(d > 0 && currTT[d].startTime == currTT[d-1].startTime){
                currTT.splice(d, 1);
            } 
        }

        const isAvailable = (lessonNumber) => {
            return currTT[lessonNumber - 1] != undefined && currTT[lessonNumber - 1].code == 'cancelled';
        }

        if (isAvailable(currLesson.name)) {
            // Free
            const freeRoom = { name: currRoom, additionalHours: 0 };

            if (currLesson.name < maxLesson) {
                for (var t = currLesson.name + 1; t < maxLesson + 1; t++) {
                    if (isAvailable(t)) freeRoom.additionalHours++;
                    else break;
                }
            }

            freeRoomsCurr.push(freeRoom);
        }

        if (isAvailable(nextLesson.name)) {
            const freeRoom = { name: currRoom, additionalHours: 0 };

            if (nextLesson.name < maxLesson) {
                for (var t = nextLesson.name + 1; t < maxLesson; t++) {
                    if (isAvailable(t)) freeRoom.additionalHours++;
                    else break;
                }
            }

            freeRoomsNext.push(freeRoom);
        }
    }

    freeRoomsCurr.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    });

    freeRoomsNext.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    });

    const tmp = { lessonNumber: currLesson.name, date, current: { a: [], b: [], c: [] }, next: { a: [], b: [], c: [] } };

    for (var i = 0; i < freeRoomsCurr.length; i++) {
        if (freeRoomsCurr[i].name[0] == 'A') tmp.current.a.push(freeRoomsCurr[i]);
        else if (freeRoomsCurr[i].name[0] == 'B') tmp.current.b.push(freeRoomsCurr[i]);
        else if (freeRoomsCurr[i].name[0] == 'C') tmp.current.c.push(freeRoomsCurr[i]);
    }

    for (var i = 0; i < freeRoomsNext.length; i++) {
        if (freeRoomsNext[i].name[0] == 'A') tmp.next.a.push(freeRoomsNext[i]);
        else if (freeRoomsNext[i].name[0] == 'B') tmp.next.b.push(freeRoomsNext[i]);
        else if (freeRoomsNext[i].name[0] == 'C') tmp.next.c.push(freeRoomsNext[i]);
    }

    freeRooms = tmp;
    logger.info('Found ' + freeRoomsCurr.length + ' free rooms for this lesson and ' + freeRoomsNext.length + ' free rooms for the next lesson');
}

function findLessonData(date, timeUnits){
    for (var i = 0; i < timeUnits.length; i++) {
        const { name, startTime, endTime } = timeUnits[i];
        const startStr = startTime < 1000 ? '0' + startTime : startTime + '';
        const endStr = endTime < 1000 ? '0' + endTime : endTime + '';
        const startDate = new Date(date);
        const endDate = new Date(date);

        startDate.setHours(parseInt(startStr.substring(0, 2)));
        startDate.setMinutes(parseInt(startStr.substring(2, 4)));

        endDate.setHours(parseInt(endStr.substring(0, 2)));
        endDate.setMinutes(parseInt(endStr.substring(2, 4)));

        if (date >= startDate && date < endDate) {
            // its the lesson
            currLesson = timeUnits[i];
            nextLesson = i < timeUnits.length - 1 ? timeUnits[i + 1] : undefined;
            currLesson.name = parseInt(currLesson.name);
            if (nextLesson) nextLesson.name = parseInt(nextLesson.name);
            return { currLesson, nextLesson };
        }
    }
}

module.exports = setup;