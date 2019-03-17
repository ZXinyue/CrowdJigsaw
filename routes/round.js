'use strict'
var express = require('express');
var router = express.Router();
var RoundModel = require('../models/round').Round;
var UserModel = require('../models/user').User;
var ActionModel = require('../models/action').Action;
var UsergraphsModel = require('../models/usergraphs').Usergraphs;
var util = require('./util.js');
var images = require("images");
var PythonShell = require('python-shell');

const redis = require('redis').createClient();

function getRoundFinishTime(startTime) {
    let finishTime = Math.floor(((new Date()).getTime() - startTime) / 1000);
    let hours = Math.floor(finishTime / 3600);
    let minutes = Math.floor((finishTime - hours * 3600) / 60);
    let seconds = finishTime - hours * 3600 - minutes * 60;
    if (hours >= 0 && hours <= 9) {
        hours = '0' + hours;
    }
    if (minutes >= 0 && minutes <= 9) {
        minutes = '0' + minutes;
    }
    if (seconds >= 0 && seconds <= 9) {
        seconds = '0' + seconds;
    }
    return hours + ":" + minutes + ":" + seconds;
}

function createRecord(player_name, round_id, join_time) {
    let condition = {
        username: player_name
    };
    let operation = {
        $push: {
            records: {
                round_id: round_id,
                join_time: join_time
            }
        }
    };
    UserModel.findOneAndUpdate(condition, operation, function (err) {
        if (err) {
            console.log(err);
        }
    });
}

function LoginFirst(req, res, next) {
    if (!req.session.user) {
        req.session.error = 'Please Login First!';
        return res.redirect('/login');
    }
    next();
}

function isCreator(req, res, next) {
    RoundModel.findOne({
        round_id: req.params.round_id
    }, {
        _id: 0,
        creator: 1
    }, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (doc) {
                if (!req.session.user) {
                    req.session.error = 'Please Login First!';
                    return res.redirect('/login');
                }
                if (doc.creator != req.session.user.username) {
                    req.session.error = "You are not the Boss!";
                }
                next();
            }
        }
    });
}
function findArray(array, arrayList) {
    for(var i=0; i<arrayList.length; i++){
        var temp = arrayList[i];
        var same = true;
        for(var j=0;j<array.length;j++){
            if(array[j]!=temp[j]){
                same = false;
                break;
            }
        }
        if(same){
            return same;
        }
    }
    return false;
}

module.exports = function (io) {

    io.on('connection', function (socket) {
        /**
         * Create a new round
         */
        socket.on('newRound', function (data) {
            RoundModel.count({}, function (err, docs_size) {
                if (err) {
                    console.log(err);
                } else {
                    let index = docs_size;
                    let TIME = util.getNowFormatDate();
                    let imageSrc = data.imageURL;
                    let image = images('public/' + imageSrc);
                    let size = image.size();
                    let imageWidth = size.width;
                    let imageHeight = size.height;
                    let tileWidth = 64;
                    let tilesPerRow = Math.floor(imageWidth / tileWidth);
                    let tilesPerColumn = Math.floor(imageHeight / tileWidth);
                    let shapeArray = util.getRandomShapes(tilesPerRow, tilesPerColumn, data.shape, data.edge);
                    let operation = {
                        round_id: index,
                        creator: data.username,
                        image: imageSrc,
                        level: data.level,
                        shape: data.shape,
                        edge: data.edge,
                        border: data.border,
                        create_time: TIME,
                        players_num: data.players_num,
                        players: [{
                            player_name: data.username,
                            join_time: TIME
                        }],
                        imageWidth: imageWidth,
                        imageHeight: imageHeight,
                        tileWidth: tileWidth,
                        tilesPerRow: tilesPerRow,
                        tilesPerColumn: tilesPerColumn,
                        tile_num: tilesPerRow * tilesPerColumn,
                        row_num: tilesPerRow,
                        shapeArray: shapeArray
                    };

                    if (data.players_num == 1) {
                        operation.players = [{
                            player_name: data.username,
                            join_time: TIME
                        }]
                    }

                    createRecord(data.username, operation.round_id, TIME);

                    RoundModel.create(operation, function (err, doc) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(data.username + ' creates Round' + index);
                            io.sockets.emit('roundChanged', {
                                round: doc,
                                username: data.username,
                                round_id: doc.round_id,
                                action: "create",
                                title: "CreateRound",
                                msg: 'You just create and join round' + doc.round_id
                            });
                        }
                    });
                }
            });
        });

        socket.on('joinRound', function (data) {
            let condition = {
                round_id: data.round_id
            };
            // check if joinable
            RoundModel.findOne(condition, function (err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    if (doc) {
                        if (doc.players.length < doc.players_num) {
                            let isIn = doc.players.some(function (p) {
                                return (p.player_name == data.username);
                            });
                            let TIME = util.getNowFormatDate();
                            if (!isIn) {
                                let operation = {
                                    $addToSet: { //if exists, give up add
                                        players: {
                                            player_name: data.username,
                                            join_time: TIME
                                        }
                                    }
                                };
                                RoundModel.update(condition, operation, function (err, doc) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        RoundModel.findOne(condition, function (err, doc) {
                                            if (err) {
                                                console.log(err);
                                            } else {
                                                io.sockets.emit('roundChanged', {
                                                    round: doc,
                                                    username: data.username,
                                                    round_id: data.round_id,
                                                    action: "join",
                                                    title: "JoinRound",
                                                    msg: 'You just join round' + data.round_id
                                                });
                                            }
                                        });
                                        console.log(data.username + ' joins Round' + condition.round_id);
                                        createRecord(data.username, data.round_id, TIME);
                                    }
                                });

                            }
                        }
                    }
                }
            });
        });
        socket.on('iSolved', function (data) {
            console.log('!!!Round ' + data.round_id + ' is solves!');
            let finish_time = getRoundFinishTime(data.startTime);
            let operation = {
                $set: {
                    "winner": data.player_name,
                    "solved_players": 1,
                    "winner_time": finish_time,
                    "winner_steps": data.steps,
                }
            };
            RoundModel.findOne({
                    round_id: data.round_id
                },
                function (err, doc) {
                    if (err) {
                        console.log(err);
                    } else {
                        if (doc) {
                            var redis_key = 'round:' + data.round_id;
                            redis.set(redis_key, JSON.stringify(doc));
                            if (doc.solved_players == 0) {
                                // only remember the first winner of the round
                                RoundModel.update({
                                    round_id: data.round_id
                                }, operation, function (err) {
                                    if (err) {
                                        console.log(err);
                                    }
                                    else{
                                        // socket.broadcast.emit('forceLeave', {
                                        //     round_id: data.round_id
                                        // });
                                    }
                                });
                            } else {
                                var solved_players = doc.solved_players;
                                RoundModel.update({
                                    round_id: data.round_id
                                }, {
                                    "solved_players": solved_players + 1
                                }, function (err) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        // socket.broadcast.emit('forceLeave', {
                                        //     round_id: data.round_id
                                        // });
                                    }
                                });
                            }


                            let TIME = util.getNowFormatDate();
                            operation = {
                                $set: {
                                    "end_time": TIME,
                                    "steps": data.steps,
                                    "time": finish_time,
                                    "score": data.score,
                                }
                            };

                            let finishTime = Math.floor(((new Date()).getTime() - data.startTime) / 1000);


                            let condition = {
                                user_name: data.player_name,
                                round_id: data.round_id
                            };

                            UsergraphsModel.update(condition, operation, function (err, doc) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log(data.player_name + ' saves his record');
                                }
                            });

                            socket.broadcast.emit('someoneSolved', data);
                        }
                    }
                });
        });
        socket.on('saveGame', function (data) {
            var save_game = {
                round_id: data.round_id,
                steps: data.steps,
                realSteps: data.realSteps,
                startTime: data.startTime,
                maxSubGraphSize: data.maxSubGraphSize,
                tiles: data.tiles,
                tileHintedLinks: data.tileHintedLinks,
                totalHintsNum: data.totalHintsNum,
                correctHintsNum: data.correctHintsNum
            };

            let redis_key = 'user:' + data.player_name + ':savegame';
            redis.set(redis_key, JSON.stringify(save_game), function (err, response) {
                if (err) {
                    console.log(err);
                    socket.emit('gameSaved', {
                        err: err
                    });
                } else {
                    socket.emit('gameSaved', {
                        success: true,
                        round_id: data.round_id,
                        player_name: data.player_name
                    });
                }
            });
        });
        /**
         * Load a game by one user
         */
        socket.on('loadGame', function (data) {
            let redis_key = 'user:' + data.username + ':savegame';
            redis.get(redis_key, function (err, save_game) {
                //console.log(save_game);
                io.sockets.emit('loadGameSuccess', {
                    username: data.username,
                    gameData: JSON.parse(save_game)
                });
            });
        });

        socket.on('getScore',function(data) {
            let condition = {
                round_id: data.round_id,
                user_name: data.player_name,
            };
            UsergraphsModel.findOne(condition, function (err, doc) {
                if (err) {
                    console.log(err);
                }
                else {
                    if (doc) {
                        var score = doc.score;
                        io.sockets.emit('addScore', {
                            score: score,
                            round_id: data.round_id,
                            player_name: data.player_name,
                        });

                    }
                }
            });
        });


        socket.on('startRound', function (data) {
            let condition = {
                round_id: data.round_id,
            };
            // check if the players are enough
            // findOneAndUpdate
            RoundModel.findOne(condition, function (err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    if (doc) {
                        if (doc.start_time != '-1') {
                            return;
                        }
                        let TIME = util.getNowFormatDate();
                        // set start_time for all players
                        console.log("players:",doc.players);
                        for (let p of doc.players) {
                            let operation = {
                                $set: {
                                    "records.$.start_time": TIME
                                }
                            };
                            UserModel.update({
                                username: p.player_name,
                                "records.round_id": data.round_id
                            }, operation, function (err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                            let operation2 = {
                                round_id : data.round_id,
                                user_name : p.player_name,
                                graph_s2: new Array(),
                                graph_s3: new Array(),
                                graph_s4: new Array(),
                                graph_s5: new Array(),
                                score: 0,
                            }
                            UsergraphsModel.create(operation2, function (err, doc) {
                                if(err){
                                    console.log(err);
                                }else{
                                    console.log("usergraph init");
                                }

                            });

                        }
                        let op = {
                            round_id : data.round_id,
                            user_name : "allallall",
                            graph_s2: new Array(),
                            graph_s3: new Array(),
                            graph_s4: new Array(),
                            graph_s5: new Array(),
                        }
                        UsergraphsModel.create(op,function(err,doc){
                            if(err){
                                console.log(err);
                            }
                            else{
                                console.log("allallall init");
                            }
                        });
                        // set start time for round
                        let operation = {
                            $set: {
                                start_time: TIME,
                                players_num: doc.players.length
                            }
                        };
                        RoundModel.update(condition, operation, function (err, doc) {
                            if (err) {
                                console.log(err);
                            } else {
                                RoundModel.findOne(condition, function (err, doc) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        io.sockets.emit('roundChanged', {
                                            round: doc,
                                            username: data.username,
                                            round_id: data.round_id,
                                            action: "start",
                                            title: "StartRound",
                                            msg: 'You just start round' + data.round_id
                                        });
                                    }
                                });
                                console.log(data.username + ' starts Round' + data.round_id);
                            }
                        });
                        /*
                        // run genetic algorithm
                        console.log('start running python script of GA algorithm for round %d.', doc.round_id);
                        var path = require('path');
                        var options = {
                            mode: 'text',
                            pythonPath: 'python3',
                            pythonOptions: ['-u'], // get print results in real-time
                            scriptPath: path.resolve(__dirname, '../../gaps/bin'),
                            args: ['--algorithm', 'crowd',
                                '--image', path.resolve(__dirname, '../public') + '/' + doc.image,
                                '--size', doc.tileWidth.toString(),
                                '--cols', doc.tilesPerRow.toString(),
                                '--rows', doc.tilesPerColumn.toString(),
                                '--population', '600',
                                '--generations', '1000000000',
                                '--roundid', doc.round_id.toString()]
                        };
                        PythonShell.run('gaps', options, function (err, results) {
                            if (err)
                                console.log(err);
                            // results is an array consisting of messages collected during execution
                            // if GA founds a solution, the last element in results is "solved".
                            console.log('results: %j', results);
                            console.log('GA algorithm for round %d ends.', doc.round_id);
                        });*/
                    }
                }
            });
        });

        socket.on('quitRound', function (data) {
            let condition = {
                round_id: data.round_id
            };
            RoundModel.findOne(condition, function (err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    if (doc) {
                        let isIn = doc.players.some(function (p) {
                            return (p.player_name == data.username);
                        });
                        if (isIn) {
                            if (doc.players.length == 1) { // the last player
                                let operation = {
                                    $pull: {
                                        players: {
                                            player_name: data.username
                                        }
                                    },
                                    end_time: util.getNowFormatDate()
                                };
                                RoundModel.update(condition, operation, function (err, doc) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        RoundModel.findOne(condition, function (err, doc) {
                                            if (err) {
                                                console.log(err);
                                            } else {
                                                io.sockets.emit('roundChanged', {
                                                    round: doc,
                                                    username: data.username,
                                                    round_id: data.round_id,
                                                    action: "quit",
                                                    title: "StopRound",
                                                    msg: 'You just stop round' + data.round_id
                                                });
                                            }
                                        });
                                        console.log(data.username + ' stops Round' + data.round_id);
                                    }
                                });
                            } else { // online>=2
                                let operation = {
                                    $pull: { //if exists, give up add
                                        players: {
                                            player_name: data.username
                                        }
                                    }
                                };
                                RoundModel.update(condition, operation, function (err, doc) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        RoundModel.findOne(condition, function (err, doc) {
                                            if (err) {
                                                console.log(err);
                                            } else {
                                                io.sockets.emit('roundChanged', {
                                                    round: doc,
                                                    username: data.username,
                                                    round_id: data.round_id,
                                                    action: "quit",
                                                    title: "QuitRound",
                                                    msg: 'You just quit round' + data.round_id
                                                });
                                            }
                                        });
                                        console.log(data.username + ' quits Round' + data.round_id);
                                    }
                                });
                            }
                        }
                    }
                }
            });
        });

        socket.on('saveRecord', function (data) {
            let operation = {};
            let rating = data.rating;
            let condition = {
                "user_name": data.player_name,
                "round_id": data.round_id
            };

            if (data.finished) {
                operation = {
                    $set: {
                        "rating": rating
                    }
                };
            } else {
                condition["end_time"] = "-1";
                operation = {
                    $set: {
                        "steps": data.steps,
                        "time": getRoundFinishTime(data.startTime),
                        "score": data.score,
                        "rating": rating,
                    }
                };
            }

            UsergraphsModel.update(condition, operation, function (err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(data.player_name + ' saves his record: ');
                }
            });
        });


    socket.on('uploadUserGraph',function(data){
        let condition = {
            round_id : data.round_id,
            user_name : data.player_name,
        };
        let allCondition = {
            round_id : data.round_id,
            user_name : "allallall",
        };
        var alls2 = new Array(),alls3 = new Array(),alls4 = new Array(),alls5 = new Array();
        //var alls2,alls3,alls4,alls5;
        UsergraphsModel.findOne(allCondition,function(err,doc){
            if(err){
                console.log(err);
            }
            else if(doc){
                console.log("find allallall");
                alls2 = doc.graph_s2;
                console.log("dddddddd",doc.graph_s2);
                alls3 = doc.graph_s3;
                alls4 = doc.graph_s4;
                alls5 = doc.graph_s5;
            }
        });
        console.log("alls:",alls2);
        //console.log("userGraphssss",UsergraphsModel.find({}));
        UsergraphsModel.findOne(condition, function (err, doc) {
            if(err){
                console.log(err);
            }
            else{
                if(doc){
                    let operation = {};
                    var graphArray;
                    var score;
                    if(data.size == 2){
                        graphArray = doc.graph_s2;
                        score = doc.score;
                        if(!findArray(data.tileIndexArray,graphArray)){
                            graphArray.push(data.tileIndexArray);
                            score = score+10;
                            operation = {
                                $set:{
                                    "graph_s2" : graphArray,
                                    "score" : score,
                                }
                            };
                            UsergraphsModel.update(condition,operation,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    console.log("add 10 la");
                                    io.sockets.emit('addScore',{
                                        score : score,
                                        round_id : data.round_id,
                                        player_name : data.player_name,
                                    });
                                }
                            });
                            if(!findArray(data.tileIndexArray,alls2)){
                                alls2.push(data.tileIndexArray);
                                operation = {
                                    $set:{
                                        "graph_s2" : alls2,
                                    }
                                };
                                UsergraphsModel.update(allCondition,operation,function(err,doc){
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        console.log(" new 2*2 add in all");
                                    }
                                });
                            };
                        }
                        else{
                            io.sockets.emit('already_exist',{});
                        }
                    }
                    if(data.size == 3){
                        graphArray = doc.graph_s3;
                        score = doc.score;
                        if(!findArray(data.tileIndexArray,graphArray)){
                            graphArray.push(data.tileIndexArray);
                            score = score+20;
                            operation = {
                                $set:{
                                    "graph_s3" : graphArray,
                                    "score" : score,
                                }
                            };
                            UsergraphsModel.update(condition,operation,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    socket.emit("addScore",{
                                        score : score,
                                        round_id : data.round_id,
                                        player_name : data.player_name,
                                    })
                                }
                            });
                            if(!findArray(data.tileIndexArray,alls3)){
                                alls3.push(data.tileIndexArray);

                                for(var i=0;i<2;i++)
                                    for(var j=0;j<2;j++){
                                        var tempArray = new Array();
                                        for(var s=i; s<i+2 ;s++)
                                            for(var t=j; t<j+2; t++){
                                                tempArray.push(data.tileIndexArray[s*3+t]);
                                            }
                                        if(!findArray(tempArray,alls2)){
                                            alls2.push(tempArray);
                                        }
                                    }
                                operation = {
                                    $set:{
                                        "graph_s3" : alls3,
                                        "graph_s2" : alls2,
                                    }
                                };
                                UsergraphsModel.update(allCondition,operation,function(err,doc){
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        console.log(" new 3*3 add in all");
                                    }
                                });
                            };


                        }
                        else{
                            socket.emit("already_exist",{});
                        }
                    }
                    if(data.size == 4){
                        graphArray = doc.graph_s4;
                        score = doc.score;
                        if(!findArray(data.tileIndexArray,graphArray)){
                            graphArray.push(data.tileIndexArray);
                            score = score+40;
                            operation = {
                                $set:{
                                    "graph_s4" : graphArray,
                                    "score" : score,
                                }
                            };
                            UsergraphsModel.update(condition,operation,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    socket.emit("addScore",{
                                        round_id : data.round_id,
                                        player_name : data.player_name,
                                        score : score,
                                    })
                                }
                            });
                            if(!findArray(data.tileIndexArray,alls4)){
                                alls4.push(data.tileIndexArray);
                                for(var i=0;i<3;i++)
                                    for(var j=0;j<3;j++){
                                        var tempArray = new Array();
                                        for(var s=i; s<i+2 ;s++)
                                            for(var t=j; t<j+2; t++){
                                                tempArray.push(data.tileIndexArray[s*4+t]);
                                            }
                                        if(!findArray(tempArray,alls2)){
                                            alls2.push(tempArray);
                                        }
                                    }
                                for(var i=0;i<2;i++)
                                    for(var j=0;j<2;j++){
                                        var tempArray = new Array();
                                        for(var s=i; s<i+3 ;s++)
                                            for(var t=j; t<j+3; t++){
                                                tempArray.push(data.tileIndexArray[s*4+t]);
                                            }
                                        if(!findArray(tempArray,alls3)){
                                            alls3.push(tempArray);
                                        }
                                    }
                                operation = {
                                    $set:{
                                        "graph_s4" : alls4,
                                        "graph_s3" : alls3,
                                        "graph_s2" : alls2,
                                    }
                                };
                                UsergraphsModel.update(allCondition,operation,function(err,doc){
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        console.log(" new 4*4 add in all");
                                    }
                                });
                            };
                        }
                        else{
                            socket.emit("already_exist",{});
                        }
                    }
                    if(data.size == 5){
                        graphArray = doc.graph_s5;
                        score = doc.score;
                        if(!findArray(data.tileIndexArray,graphArray)){
                            graphArray.push(data.tileIndexArray);
                            score = score+80;
                            operation = {
                                $set:{
                                    "graph_s5" : graphArray,
                                    "score" : score,
                                }
                            };
                            UsergraphsModel.update(condition,operation,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else{
                                    socket.emit("addScore",{
                                        round_id : data.round_id,
                                        player_name : data.player_name,
                                        score : score,
                                    })
                                }
                            });
                            if(!findArray(data.tileIndexArray,alls5)){
                                alls5.push(data.tileIndexArray);
                                for(var i=0;i<4;i++)
                                    for(var j=0;j<4;j++){
                                        var tempArray = new Array();
                                        for(var s=i; s<i+2 ;s++)
                                            for(var t=j; t<j+2; t++){
                                                tempArray.push(data.tileIndexArray[s*5+t]);
                                            }
                                        if(!findArray(tempArray,alls2)){
                                            alls2.push(tempArray);
                                        }
                                    }
                                for(var i=0;i<3;i++)
                                    for(var j=0;j<3;j++){
                                        var tempArray = new Array();
                                        for(var s=i; s<i+3 ;s++)
                                            for(var t=j; t<j+3; t++){
                                                tempArray.push(data.tileIndexArray[s*5+t]);
                                            }
                                        if(!findArray(tempArray,alls3)){
                                            alls3.push(tempArray);
                                        }
                                    }
                                for(var i=0;i<2;i++)
                                    for(var j=0;j<2;j++){
                                        var tempArray = new Array();
                                        for(var s=i; s<i+4 ;s++)
                                            for(var t=j; t<j+4; t++){
                                                tempArray.push(data.tileIndexArray[s*5+t]);
                                            }
                                        if(!findArray(tempArray,alls4)){
                                            alls4.push(tempArray);
                                        }
                                    }
                                operation = {
                                    $set:{
                                        "graph_s5" : alls5,
                                        "graph_s4" : alls4,
                                        "graph_s3" : alls3,
                                        "graph_s2" : alls2,
                                    }
                                };
                                UsergraphsModel.update(allCondition,operation,function(err,doc){
                                    if(err){
                                        console.log(err);
                                    }
                                    else{
                                        console.log(" new 5*5 add in all");
                                    }
                                });
                            };
                        }
                        else{
                            socket.emit("already_exist",{});
                        }
                    }
                }
                else{
                    console.log("not find the data from usergraph");
                }
            }

        });
    });

    socket.on('getHint',function(data){
        let condition = {
            round_id : data.round_id,
            user_name : 'allallall',
        };
        let condition2 = {
            round_id : data.round_id,
            user_name : data.player_name,
        };
        UsergraphsModel.findOne(condition,function(err,doc){
            if(err){
                console.log(err);
            }
            else{
                if(doc){
                    var returnArray = null;
                    if(data.hintSize == 2){
                        if(doc.graph_s2){
                            var randomindex = Math.floor(Math.random() * doc.graph_s2.length);
                            returnArray = doc.graph_s2[randomindex];
                        }
                        socket.emit("hintReturn",{
                            returnArray: returnArray,
                            returnSize: 2,
                            round_id: data.round_id,
                            player_name: data.player_name,
                        });
                        if(returnArray){
                            UsergraphsModel.findOne(condition2,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else if(doc){
                                    var graphArray = doc.graph_s2;
                                    if(!findArray(returnArray,graphArray)){
                                        graphArray.push(returnArray);
                                        let operation = {
                                            $set:{
                                                "graph_s2" : graphArray,
                                            }
                                        };
                                        UsergraphsModel.update(condition2,operation,function(err,doc){
                                            if(err){
                                                console.log(err);
                                            }
                                        });
                                    }
                                }
                            })
                        }
                    }
                    else if(data.hintSize == 3){
                        if(doc.graph_s3){
                            var randomindex = Math.floor(Math.random() * doc.graph_s3.length);
                            returnArray = doc.graph_s3[randomindex];
                        }
                        socket.emit("hintReturn",{
                            returnArray: returnArray,
                            returnSize: 3,
                            round_id: data.round_id,
                            player_name: data.player_name,
                        });
                        if(returnArray){
                            UsergraphsModel.findOne(condition2,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else if(doc){
                                    var graphArray = doc.graph_s3;
                                    if(!findArray(returnArray,graphArray)){
                                        graphArray.push(returnArray);
                                        let operation = {
                                            $set:{
                                                "graph_s3" : graphArray,
                                            }
                                        };
                                        UsergraphsModel.update(condition2,operation,function(err,doc){
                                            if(err){
                                                console.log(err);
                                            }
                                        });
                                    }
                                }
                            })
                        }

                    }
                    else if(data.hintSize == 4){
                        if(doc.graph_s4){
                            var randomindex = Math.floor(Math.random() * doc.graph_s4.length);
                            returnArray = doc.graph_s4[randomindex];
                        }
                        socket.emit("hintReturn",{
                            returnArray: returnArray,
                            returnSize: 4,
                            round_id: data.round_id,
                            player_name: data.player_name,
                        });
                        if(returnArray){
                            UsergraphsModel.findOne(condition2,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else if(doc){
                                    var graphArray = doc.graph_s4;
                                    if(!findArray(returnArray,graphArray)){
                                        graphArray.push(returnArray);
                                        let operation = {
                                            $set:{
                                                "graph_s4" : graphArray,
                                            }
                                        };
                                        UsergraphsModel.update(condition2,operation,function(err,doc){
                                            if(err){
                                                console.log(err);
                                            }
                                        });
                                    }
                                }
                            })
                        }
                    }
                    else if(data.hintSize ==5){
                        if(doc.graph_s5){
                            var randomindex = Math.floor(Math.random() * doc.graph_s5.length);
                            returnArray = doc.graph_s5[randomindex];
                        }
                        socket.emit("hintReturn",{
                            returnArray: returnArray,
                            returnSize: 5,
                            round_id: data.round_id,
                            player_name: data.player_name,
                        });
                        if(returnArray){
                            UsergraphsModel.findOne(condition2,function(err,doc){
                                if(err){
                                    console.log(err);
                                }
                                else if(doc){
                                    var graphArray = doc.graph_s5;
                                    if(!findArray(returnArray,graphArray)){
                                        graphArray.push(returnArray);
                                        let operation = {
                                            $set:{
                                                "graph_s5" : graphArray,
                                            }
                                        };
                                        UsergraphsModel.update(condition2,operation,function(err,doc){
                                            if(err){
                                                console.log(err);
                                            }
                                        });
                                    }
                                }
                            })
                        }
                    }
                }
            }
        })



    })

    }
    );

    /**
     * Get all rounds
     */
    router.route('/').all(LoginFirst).get(function (req, res, next) {
        RoundModel.find({}, function (err, docs) {
            res.send(JSON.stringify(docs));
        });
    });

    /**
     * Get all Joinable rounds
     */
    router.route('/getJoinableRounds').all(LoginFirst).get(function (req, res, next) {
        let condition = {
            end_time: "-1"
        };
        RoundModel.find(condition, function (err, docs) {
            if (err) {
                console.log(err);
            } else {
                // let temp=new Array();
                // for(let d of docs){
                //     if(d.players.length < d.player_name){
                //         temp.push(d);
                //     }
                // }
                res.send(JSON.stringify(docs));
            }
        });
    });

    /**
     * Get the round contribution rank
     */
    router.route('/getRoundRank/:round_id').all(LoginFirst).get(function (req, res, next) {
        // RoundModel.findOne({
        //     round_id: req.params.round_id
        // }, {
        //     _id: 0,
        //     players: 1
        // }, {}, function (err, doc) {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         if (doc) {
        //             let rankedPlayers = new Array();
        //             let temp = doc.players;
        //             temp = temp.sort(util.descending("contribution"));
        //             for (let i = 0; i < temp.length; i++) {
        //                 let t = temp[i];
        //                 rankedPlayers.push({
        //                     "rank": i + 1,
        //                     "player_name": t.player_name,
        //                     "contribution": t.contribution.toFixed(3)
        //                     //Math.round(t.contribution*1000)/1000
        //                 });
        //             }
        //             // res.render('roundrank', { title: 'Round Rank', AllPlayers: JSON.stringify(rankedPlayers), username: req.session.user.username });
        //             res.send({
        //                 AllPlayers: rankedPlayers
        //             });
        //         }
        //     }
        // });
        let condition = {"round_id":round_id};
        UsergraphsModel.find(condition,function(err,docs){
            if(err){
                console.log(err);
            }
            else{
                if(doc){
                    let finished = new Array();
                    let unfinished = new Array();
                    for(let i=0;i<docs.length;i++){
                        let t = docs[i];
                        if(t.end_time != "-1"){
                            finished.push({
                                "rank":i+1,
                                "playername":t.user_name,
                                "score":t.score,
                                "steps":t.steps,
                                "time":t.time,
                            })
                        }
                        else{
                            unfinished.push({
                                "rank":i+1,
                                "playername":t.user_name,
                                "score":t.score,
                                "steps":t.steps,
                                "time":t.time,
                            })
                        }

                    }
                    finished = finished.sort(util.ascending("time"));
                    unfinished = unfinished.sort(util.descending("score"));
                    res.render('roundrank', {
                        title: 'Round Rank',
                        Finished: finished,
                        Unfinished: unfinished,
                        username: req.session.user.username,
                        round_id: req.params.round_id
                    });
                }
            }
        })
    });

    /**
     * Get round details with roundid
     */
    router.route('/getRoundDetails/:round_id').all(LoginFirst).get(function (req, res, next) {
        let condition = {
            round_id: req.params.round_id
        };
        let fields = {
            _id: 0,
            creator: 1,
            // image: 1,
            shape: 1,
            level: 1,
            edge: 1,
            border: 1,
            tile_num: 1,
            winner_time: 1
        };
        RoundModel.findOne(condition, fields, function (err, doc) {
            if (err) {
                console.log(err);
            } else {
                res.send(doc);
            }
        });
    });


    /**
     * Get hint ration&precision in a dirty way
     */
    function getHRHP(round_id) {
        return new Promise((resolve, reject) => {
            RoundModel.findOne({
                round_id: round_id
            }, function (err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    if (doc) {
                        if (doc.winner) {
                            UserModel.findOne({
                                username: doc.winner
                            }, {
                                _id: 0,
                                records: 1
                            }, function (err, d) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    if (d) {
                                        for (let r of d.records) {
                                            if (r.round_id == round_id) {
                                                let hint_ratio = 0;
                                                let hint_precision = 0;
                                                if (r.total_links > 0 && r.total_hints > 0) {
                                                    hint_ratio = r.hinted_links / r.total_links;
                                                    hint_precision = r.correct_hints / r.total_hints;
                                                }
                                                resolve({
                                                    "hint_ratio": hint_ratio,
                                                    "hint_precision": hint_precision
                                                });
                                            }
                                        }
                                    }
                                }
                            });
                        } else {
                            console.log("Winner Empty " + round_id);
                            resolve({
                                "hint_ratio": 0,
                                "hint_precision": 0
                            });
                        }
                    }
                }
            });
        });
    }
    /**
     * Get the data required by statistics
     */
    function getWinnerData(round_id) {
        return new Promise((resolve, reject) => {
            RoundModel.findOne({
                round_id: round_id
            }, function (err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    if (doc) {
                        if (doc.winner_time != "-1" && doc.winner_steps != -1) {
                            let time = doc.winner_time.split(":");
                            let h = parseInt(time[0]);
                            let m = parseInt(time[1]);
                            let s = parseInt(time[2]);
                            resolve({
                                "time": h * 3600 + m * 60 + s,
                                "steps": doc.winner_steps
                            });
                        } else {
                            console.log("Empty: " + round_id);
                        }
                    }
                }
            });
        });
    }

    router.route('/getStatistics').get(async function (req, res, next) {
        // ids[0][0]=1--4 ids[0][1]
        // ids[x][y]=x+1--y+4
        let ids = [
            // 1 participant
            [
                [242, 243, 301, 302, 303, 272, 279, 286], // 4x4
                [248, 250, 304, 306, 307, 273, 280, 287], // 5x5
                [308, 309, 310, 274, 281, 288], // 6x6             
                [311, 312, 313, 275, 282, 289], // 7x7
                [314, 315, 316, 276, 283, 290], // 8x8
                [317, 318, 319, 277, 284, 291], // 9x9
                [305, 320, 321, 278, 285, 292, 346] // 10x10
            ],
            // 2 participants
            [
                [240, 331],
                [332, 334, 525],
                [247, 333, 498],
                [335],
                [356],
                [357, 527],
                [347, 481, 482]
            ],
            // 3 participants
            [
                [337, 339, 412, 421],
                [338, 340],
                [245, 246, 522],
                [336, 341, 432, 523],
                [342],
                [344, 524],
                [440, 460]
            ],
            // 4 participants
            [
                [348],
                [349, 422],
                [350, 424],
                [351],
                [352],
                [354, 426],
                [355, 488, 489]
            ],
            // 5 participants
            [
                [392],
                [405],
                [406, 441],
                [407],
                [408, 450, 451],
                [434, 459],
                [442, 487]
            ],
            // 6 participants
            [
                [386],
                [388],
                [389, 390],
                [393],
                [395],
                [398],
                [403, 486]
            ],
            // 7 participants
            [
                [387, 391],
                [394],
                [396],
                [397],
                [399, 438],
                [436],
                [439, 456, 252]
            ],
            // 8 participants
            [
                [400],
                [401, 446],
                [402],
                [404],
                [431],
                [435],
                [443, 485]
            ],
            // 9 participants
            [
                [409, 483],
                [410, 420],
                [411, 484],
                [413],
                [423],
                [425, 477],
                [427, 480]
            ],
            // 10 participants
            [
                [261, 265, 367, 373, 375, 419, 471],
                [253, 254, 259, 267, 372, 376, 472],
                [255, 256, 366, 371, 377, 475],
                [257, 258, 264, 371, 378, 474],
                [262, 263, 365, 370, 379, 476],
                [266, 268, 363, 369, 380, 478],
                [252, 361, 368, 381, 427, 429, 452, 479]
            ]
        ];

        let results = new Array();

        for (let gs = 0; gs < ids.length; gs++) {
            for (let ps = 0; ps < ids[gs].length; ps++) {
                let average_time = 0;
                let average_steps = 0;
                let average_hint_ratio = 0;
                let average_hint_precision = 0;
                for (let i = 0; i < ids[gs][ps].length; i++) {
                    let round_id = ids[gs][ps][i];
                    let data = await getWinnerData(round_id);
                    average_time += data.time;
                    average_steps += data.steps;
                    data = await getHRHP(round_id);
                    average_hint_ratio += data.hint_ratio;
                    average_hint_precision += data.hint_precision;
                }
                average_time /= ids[gs][ps].length;
                average_steps /= ids[gs][ps].length;
                average_hint_ratio /= ids[gs][ps].length;
                average_hint_precision /= ids[gs][ps].length;
                results.push({
                    "group_size": gs + 1,
                    "puzzle_size": ps + 4,
                    "average_time": average_time.toFixed(3),
                    "average_steps": average_steps.toFixed(3),
                    "average_hint_ratio": average_hint_ratio.toFixed(5),
                    "average_hint_precision": average_hint_precision.toFixed(5)
                });
            }
        }
        res.send(results);
    });

    return router;
};