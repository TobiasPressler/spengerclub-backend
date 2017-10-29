const untisApi = require('./untisapi');
const fs = require('fs');

var cache = new Object();
var pendingDeletion = [];

var classesById = new Object();
var classesByName = new Object();
var classes = [];

var teachersById = new Object();
var teachersByName = new Object();
var teachers = [];

var roomsById = new Object();
var roomsByName = new Object();
var rooms = [];

var subjectsById = new Object();
var subjectsByName = new Object();
var subjects = [];

var lastUntisImport = 0;

var timeunits = [];
var elementsRegisteredForSubService = [];

var holidays = [];

var logger;

function setup(logger_) {
    logger = logger_;

    setInterval(updateDefinitions, 1000 * 60 * 10);
    updateDefinitions();
    parseSubstitutions();
}

function fetchTimetable(id, type, nextWeek, threedee, callback) {
    var now = new Date();
    now.setDate(now.getDate() - 1);
    if (nextWeek) now.setDate(now.getDate() + 7);

    const sae = startAndEndOfWeek(now);
    const startDate = sae[0].getFullYear() +
        (sae[0].getMonth() + 1 < 10 ? '0' + (sae[0].getMonth() + 1) : (sae[0].getMonth() + 1) + '') +
        (sae[0].getDate() < 10 ? '0' + sae[0].getDate() : sae[0].getDate() + '');

    const endDate = sae[1].getFullYear() +
        (sae[1].getMonth() + 1 < 10 ? '0' + (sae[1].getMonth() + 1) : (sae[1].getMonth() + 1) + '') +
        (sae[1].getDate() < 10 ? '0' + sae[1].getDate() : sae[1].getDate() + '');

    untisApi.sendRequest('getTimetable', (error, data) => {
        if (error) {
            callback();
            return;
        }
        if (!threedee)
            callback(data);
        else {
            callback(threeDee(data, now));
        }
    }, { id, type, startDate, endDate });
}

function getCurrentLesson() {
    for (var i = 0; i < timeunits.length; i++) {
        const { name, startTime, endTime } = timeunits[i];
        const startStr = startTime < 1000 ? '0' + startTime : startTime + '';
        const endStr = endTime < 1000 ? '0' + endTime : endTime + '';
        const startDate = new Date();
        const endDate = new Date();

        startDate.setHours(parseInt(startStr.substring(0, 2)));
        startDate.setMinutes(parseInt(startStr.substring(2, 4)));

        endDate.setHours(parseInt(endStr.substring(0, 2)));
        endDate.setMinutes(parseInt(endStr.substring(2, 4)));
        var curr = new Date();

        if (curr >= startDate && curr < endDate) {
            // its the lesson
            var dateStr = curr.getFullYear() + (curr.getMonth() + 1 < 10 ? '0' + (curr.getMonth() + 1) : (curr.getMonth() + 1) + '') +
                (curr.getDate() < 10 ? '0' + curr.getDate() : curr.getDate() + '');
            return { startTime: timeunits[i].startTime, date: dateStr, number: parseInt(timeunits[i].name) };
        }
    }

    return {};
}

function threeDee(data, date) {
    const arr = [
        [],
        [],
        [],
        [],
        [],
        []
    ];

    data.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
    });

    var dates = [];

    const getDateIndex = (date) => {
        for (var i = 0; i < dates.length; i++) {
            if (dates[i] == date) return i;
        }
    }

    const dateToStrDate = (date) => {
        return date.getFullYear() +
            (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1) + '') +
            (date.getDate() < 10 ? '0' + date.getDate() : date.getDate() + '');
    }

    var day = date.getDay();
    var array = []
    for (var i = 1; i < 7; i++) {
        if (i - day != 0) {
            var days = i - day;
            var newDate = new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));

            dates.push(dateToStrDate(newDate));
        } else
            dates.push(dateToStrDate(date));
    }

    for (var i = 0; i < data.length; i++) {
        // field correction
        if (data[i].te.length > 0) data[i].teacher = data[i].te[0].id;
        if (data[i].su.length > 0) data[i].subject = data[i].su[0].id;
        if (data[i].ro.length > 0) data[i].room = data[i].ro[0].id;
        if (data[i].kl.length > 0) data[i].classes = data[i].kl;

        delete data[i].te;
        delete data[i].su;
        delete data[i].ro;
        delete data[i].kl;

        var currI = getDateIndex(data[i].date);
        if (!arr[currI]) arr[currI] = [];
        arr[currI].push(data[i]);
    }



    for (var i = 0; i < arr.length; i++) {
        arr[i].sort((a, b) => a.startTime - b.startTime);
    }

    var final = [];

    for (var i = 0; i < arr.length; i++) {
        var curr = arr[i];
        var sameLesson = [];

        for (var t = 0; t < timeunits.length; t++) {
            for (var c = 0; c < curr.length; c++) {
                if (curr[c].startTime == timeunits[t].startTime) {
                    if (sameLesson.length == 0) sameLesson.push([curr[c]]);
                    else sameLesson[0].push(curr[c]);
                }
            }

            if (!final[t]) final[t] = [];

            final[t][i] = [];


            if (sameLesson.length > 0 && sameLesson[0].length > 4) {
                sameLesson[0].sort((a, b) => a.subject - b.subject);
                var offset = 0;
                for (var l = sameLesson[0].length - 1; l >= 0; l--) {
                    if (sameLesson[0][l - 1] && sameLesson[0][l].subject == sameLesson[0][l - 1].subject) {
                        if (!sameLesson[offset + 1]) sameLesson[offset + 1] = [sameLesson[0][l]];
                        else sameLesson[offset + 1].push(sameLesson[0][l]);
                        sameLesson[0].splice(l, 1);
                        offset++;
                    } else {
                        offset = 0;
                    }
                }

                for (var c = 1; c < sameLesson.length; c++) {
                    sameLesson[c].sort((a, b) => a.subject - b.subject);
                }

            }

            final[t][i] = sameLesson;
            sameLesson = [];
        }
    }

    return final;
}

function parseSubstitutions() {
    loadTimetable(181, 1, false, false, (data) => {
        var irregularLessons = [];

        data.forEach((lesson) => {
            if(lesson.code == 'cancelled' || lesson.code == 'irregular'){
                irregularLessons.push(lesson);
            }

        });

        var msgs = [];

        irregularLessons.forEach(irrLesson => {
            if(irrLesson.code == 'irregular'){
                irregularLessons.forEach(irrLesson2 => {
                    if(irrLesson.date == irrLesson2.date &&
                    irrLesson.startTime == irrLesson2.startTime &&
                    irrLesson.endTime && irrLesson2.endTime){
                        
                    }
                });
            }
        });

        // console.log(irregularLessons);      
    });
}

function fetchTimetableDay(id, type, date, callback) {
    const dateStr = date.getFullYear() +
        (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1) + '') +
        (date.getDate() < 10 ? '0' + date.getDate() : date.getDate() + '');

    untisApi.sendRequest('getTimetable', (error, data) => {
        if (error) {
            console.log(error);
            callback();
            return;
        }

        callback(data);
    }, { id, type, startDate: dateStr, endDate: dateStr });
}

function updateDefinitions() {
    untisApi.sendRequest('getLatestImportTime', (error, data) => {
        if(!error){
            lastUntisImport = data;
            logger.info('Loaded last untis import time:' + new Date(data));
        }            
    });
    untisApi.sendRequest('getHolidays', (error, data) => {
        if(!error){
            holidays = data;
            logger.info('Loaded ' + holidays.length + ' holidays');
        }            
    });
    // classes
    untisApi.sendRequest('getKlassen', (error, data) => {
        if (error) {
            logger.error('Failed to fetch classes');
        } else {
            classesById = new Object();
            classesByName = new Object();

            for (var i = 0; i < data.length; i++) {
                Object.keys(data[i]).forEach((key) => (data[i][key] == null) && delete data[i][key]);

                classesById[data[i].id] = data[i];
                classesByName[data[i].name] = data[i];
            }

            classes = data;
            logger.info('Loaded ' + classes.length + ' classes');
        }
    });

    // rooms
    untisApi.sendRequest('getRooms', (error, data) => {
        if (error) {
            logger.error('Failed to fetch rooms');
        } else {
            roomsById = new Object();
            roomsByName = new Object();

            for (var i = 0; i < data.length; i++) {
                Object.keys(data[i]).forEach((key) => (data[i][key] == null) && delete data[i][key]);

                roomsById[data[i].id] = data[i];
                roomsByName[data[i].name] = data[i];
            }

            rooms = data;
            logger.info('Loaded ' + rooms.length + ' rooms');
        }
    });

    // subjects
    untisApi.sendRequest('getSubjects', (error, data) => {
        if (error) {
            logger.error('Failed to fetch subjects');
        } else {
            subjectsById = new Object();
            subjectsByName = new Object();

            for (var i = 0; i < data.length; i++) {
                Object.keys(data[i]).forEach((key) => (data[i][key] == null) && delete data[i][key]);

                subjectsById[data[i].id] = data[i];
                subjectsByName[data[i].name] = data[i];
            }

            subjects = data;
            logger.info('Loaded ' + subjects.length + ' subjects');
        }
    });

    // teachers
    const teachersData = require('../teachers.json').data.elements;

    for (var i = 0; i < teachersData.length; i++) {
        Object.keys(teachersData[i]).forEach((key) => (teachersData[i][key] == null) && delete teachersData[i][key]);

        teachersById[teachersData[i].id] = teachersData[i];
        teachersByName[teachersData[i].name] = teachersData[i];
    }

    teachers = teachersData;
    logger.info('Loaded ' + teachers.length + ' teachers');

    // timegrid
    untisApi.sendRequest('getTimegridUnits', (error, data) => {
        if (error) {
            logger.error('Failed to fetch timeunits');
        } else {
            timeunits = data[0].timeUnits;
            logger.info('Loaded ' + timeunits.length + ' timeunits');
        }
    });
}

function loadTimetable(id, type, nextWeek, threedee, callback) {
    var idStr = id + '-' + type + '-' + nextWeek + '-' + threedee;
    // logger.info('CURR ID STR: ' + idStr + ' #### TO DELETE: ' + JSON.stringify(pendingDeletion));
    if (cache[idStr] && pendingDeletion.indexOf(idStr) === -1) {
        // Load the timetable from cache
        callback(cache[idStr]);
        // logger.info('Returned timetable (ID: ' + id + ' Type: ' + type + ' NextWeek: ' + nextWeek + ') from cache!');
    } else {
        // Fetch the timetable form the server if possible
        fetchTimetable(id, type, nextWeek, threedee, (data) => {
            if (data && data != '') {
                callback(data);
                if(pendingDeletion.indexOf(idStr) !== -1) pendingDeletion.splice(pendingDeletion.indexOf(idStr), 1);
                cache[idStr] = data;

                if (pendingDeletion.indexOf(idStr) === -1) {
                    // logger.info('Queued timeout of ' + idStr);
                    setTimeout(() => {
                        // logger.info('Added pending deletion ' + idStr);
                        pendingDeletion.push(idStr);
                    }, 1000 * 60);
                }

                logger.info('Fetched timetable (ID: ' + id + ' Type: ' + type + ' NextWeek: ' + nextWeek + ') from WebUntis!');
            } else if (cache[idStr]) {
                // Data is stored in the cache
                logger.info('Returned timetable (ID: ' + id + ' Type: ' + type + ' NextWeek: ' + nextWeek + ') from cache due to WebUntis error!');
                callback(cache[idStr]);
            } else {
                logger.error('Failed to fetch timetable (ID: ' + id + ' Type: ' + type + ' NextWeek: ' + nextWeek + ') from WebUntis!');
                callback([]);
            }
        });
    }
}

function getClasses(mode) {
    if (mode == 'byId') return classesById;
    if (mode == 'byName') return classesByName;
    return classes;
}

function getTeachers(mode) {
    if (mode == 'byId') return teachersById;
    if (mode == 'byName') return teachersByName;
    return teachers;
}

function getRooms(mode) {
    if (mode == 'byId') return roomsById;
    if (mode == 'byName') return roomsByName;
    return rooms;
}

function getSubjects(mode) {
    if (mode == 'byId') return subjectsById;
    if (mode == 'byName') return subjectsByName;
    return subjects;
}

function getAll(mode) {
    if (mode == 'byId') return { classes: classesById, teachers: teachersById, rooms: roomsById, subjects: subjectsById };
    if (mode == 'byName') return { classes: classesByName, teachers: teachersByName, rooms: roomsByName, subjects: subjectsByName };
    return { classes, teachers, rooms, subjects };
}

function getTimeunits() {
    return timeunits;
}

function getHolidays() {
    return holidays;
}

function getLastUntisUpdateTime() {
    return lastUntisImport;
}

function startAndEndOfWeek(date) {
    // If no date object supplied, use current date
    // Copy date so don't modify supplied date
    var now = date ? new Date(date) : new Date();

    // set time to some convenient value
    now.setHours(0, 0, 0, 0);

    // Get the previous Monday
    var monday = new Date(now);
    monday.setDate(monday.getDate() - monday.getDay() + 1);

    // Get next Sunday
    var sunday = new Date(now);
    sunday.setDate(sunday.getDate() - sunday.getDay() + 7);

    // Return array of date objects
    return [monday, sunday];
}


module.exports = {
    setup,
    getClasses,
    getTeachers,
    getRooms,
    getSubjects,
    getAll,
    getTimeunits,
    getCurrentLesson,
    getHolidays,
    getLastUntisUpdateTime,
    loadTimetable,
    fetchTimetableDay
};