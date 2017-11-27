
'use strict'
var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
var RoundModel = require('../models/round').Round;
var UserModel = require('../models/user').User;
var NodeModel = require('../models/node').Node;
var util = require('./util.js');

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
        }else{
            console.log(player_name+'are in Round'+ round_id);
        }
    });
}

function LoginFirst(req, res, next) {
    if (!req.session.user) {
        req.session.error = 'Please Login First!';
        return res.redirect('/login');
        //return res.redirect('back');//返回之前的页面
    }
    next();
}

function isCreator(req, res, next){
    RoundModel.findOne({ round_id: req.params.round_id }, { _id: 0, creator: 1 }, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (!req.session.user) {
                req.session.error = 'Please Login First!';
                return res.redirect('/login');
            }

            if (doc.creator!=req.session.user.username) {
                req.session.error = "You are not the Boss!";
            }
            next();
        }
    });
}


/**
 * Init the graph for the round
 */
function initGraph(round_id, level) {
    let tiles_num = 64;
    for (let i = 0; i < tiles_num; i++) {
        new NodeModel({
            index: i,
            round_id: round_id
        }).save(function (err) {
            if (err) {
                console.log(err);
            }
        });
    }
}

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
            res.send(JSON.stringify(docs));
        }
    });
});

/**
 * Join a round
 */
router.route('/joinRound').all(LoginFirst).post(function (req, res, next) {
    let condition = {
        round_id: req.body.round_id
    };
    // check if joinable
    RoundModel.findOne(condition, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (doc.players.length < doc.players_num) {
                let isIn = doc.players.some(function (p) {
                    return (p.player_name == req.session.user.username);
                });
                let TIME = util.getNowFormatDate();
                if (!isIn) {
                    let operation = {
                        $addToSet: { //if exists, give up add
                            players:
                                {
                                    player_name: req.session.user.username,
                                    // player_name: req.session.user.username,
                                    join_time: TIME
                                }
                        }
                    };
                    RoundModel.update(condition, operation, function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(req.session.user.username +' join Round' + condition.round_id);
                            res.send({ msg: 'You joined the round successfully.' });
                            createRecord(req.session.user.username, req.body.round_id, TIME);
                        }
                    });

                } else {
                    res.send({ msg: "You are already in!" });
                }
            } else {
                res.send({ msg: "This round is full." });
            }
        }
    });
});


/**
 * Get player list for one round
 */
router.route('/getPlayers/:round_id').all(LoginFirst).get(function (req, res, next) {
    let condition = {
        round_id: req.params.round_id
    };
    RoundModel.findOne(condition, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            res.send(doc.players);
        }
    });
});

/**
 * Create a new round
 */
router.route('/newRound').all(LoginFirst).post(function (req, res, next) {
    RoundModel.find({}, function (err, docs) {
        if (err) {
            console.log(err);
        } else {
            let index = docs.length;
            let TIME = util.getNowFormatDate();
            let operation = {
                round_id: index,
                creator: req.session.user.username,
                image: req.body.imageURL,
                shape: req.body.shape,
                level: req.body.level,
                create_time: TIME,
                players_num: req.body.players_num,
                players: {
                    player_name: req.session.user.username,
                    join_time: TIME
                }
            };
            RoundModel.create(operation, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(req.session.user.username+ ' new a round '+ index);
                    res.send({ msg: "Created round successfully.", round_id: index});
                    createRecord(req.session.user.username, operation.round_id, TIME);
                }
            });
        }
    });
});

/**
 * Start a round(only by the creator, after the player_num reached)
 */
router.route('/startRound/:round_id').all(isCreator).get(function (req, res, next) {
    let condition = {
        round_id: req.params.round_id
    };
    // check if the players are enough
    // findOneAndUpdate
    RoundModel.findOne(condition, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (doc.players.length == doc.players_num) {
                let TIME = util.getNowFormatDate();
                let operation = {
                    $set: {
                        start_time: TIME
                    }
                };
                RoundModel.update(condition, operation, function (err) {
                    if (err) {
                        console.log(err);
                    } else {
                        initGraph(req.params.round_id, 1);
                        res.send({ msg: "Round Starts Now!" });
                        operation = {
                            $set: {
                                start_time: TIME
                            }
                        };
                        UserModel.findOneAndUpdate({ username: req.session.user.username }, operation, function(err, doc){
                            if(err){
                                console.log(err);
                            }else{
                                console.log(req.session.user.username + 'started playing.');
                            }
                        });
                    }
                });
            } else {
                res.send({ msg: "Players are not enough!" });
            }
        }
    });
});

/**
 * Quit a round, either by user or by accident, when unfinished
 */
router.get('/quitRound/:round_id', function (req, res, next) {
    let condition = {
        round_id: req.params.round_id
    };
    // check if joinable
    RoundModel.findOne(condition, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            let isIn = doc.players.some(function (p) {
                return (p.player_name == req.session.user.username);
            });
            if (isIn) {
                if (doc.players.length == 1) { // the last player
                    let operation = {
                        $pull: { //if exists, give up add
                            players:
                                {
                                    player_name: req.session.user.username
                                }
                        },
                        end_time: util.getNowFormatDate()
                    };
                    RoundModel.update(condition, operation, function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            res.send({ msg: "You just stopped the round..." });
                        }
                    });
                } else { // online>=2
                    let operation = {
                        $pull: { //if exists, give up add
                            players:
                                {
                                    player_name: req.session.user.username
                                }
                        }
                    };
                    RoundModel.update(condition, operation, function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            res.send({ msg: "You just quitted the round..." });
                        }
                    });
                }
                // update the record
            } else {
                res.send({ msg: "You are not even in the round!" });
            }
        }
    });
});

/**
 * Stop the round when all players finished
 */

/**
 * Save a record by one user when he gets his puzzle done
 */
router.post('/saveRecord', function (req, res, next) {
    let TIME= util.getNowFormatDate();
    let contri=0;// to be calculated
    let operation={
        $set:{
            end_time: TIME,
            steps: req.body.steps,
            time: req.body.time,
            contribution: contri
        }
    };
    UserModel.findOneAndUpdate({ username: req.session.user.username }, operation, function(err, doc){
        if(err){
            console.log(err);
        }else{
            res.send({ msg:"Your record has been saved." });
        }
    });
});

module.exports = router;