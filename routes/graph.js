'use strict'
/**
 * API operations related with the sequence&links
 * 
 */

var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
var NodeModel = require('../models/node').Node;
var UserModel = require('../models/user').User;
var RoundModel = require('../models/round').Round;
var ActionModel = require('../models/action').Action;
var util = require('./util.js');

/**
 * Get all the round graph
 *
router.route('/:round_id').all(JoinRoundFirst).get(function (req, res) {
    NodeModel.find({ round_id: req.params.round_id }, function (err, docs) {
        if (err) {
            console.log(err);
        } else {
            res.send(JSON.stringify(docs));
        }
    });
});

/**
 * Write one action into the action sequence
 */
function writeAction(NAME, round_id, operation, from, direction, to) {
    var action = {
        round_id: round_id,
        time_stamp: util.getNowFormatDate(),
        player_name: NAME,
        operation: operation,
        from: from,
        direction: direction,
        to: to
    };
    ActionModel.create(action, function (err) {
        if (err) {
            console.log(err);
            return false;
        } else {
            return true;
        }
    });
}

// Bidirectionally add one link to the other side
function biAdd(round_id, from, to, dir) {
    
    NodeModel.findOne({ round_id: round_id, index: from }, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (!doc) {
                // create the from node
                let new_node = {
                    round_id: round_id,
                    index: from
                };
                NodeModel.create(new_node, function (err) {
                    if (err) {
                        console.log(err);
                    } else {
                        // and push a new one
                        let temp = {};
                        temp[dir] = {
                            index: to,
                            sup_num: 1
                        };
                        NodeModel.update(
                            { round_id: round_id, index: from },
                            { $push: temp },
                            function (err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                    }
                });
            } else {
                // the from node exists
                // check if the 
                if (doc[dir].length == 0) {
                    // not exists
                    // push a new one
                    let temp = {};
                    temp[dir] = {
                        index: to,
                        sup_num: 1
                    };
                    NodeModel.update(
                        { round_id: round_id, index: from },
                        { $push: temp },
                        function (err) {
                            if (err) {
                                console.log(err);
                            }
                        });
                } else {
                    // check if the to link exists
                    let existed = false;
                    for (let i of doc[dir]) {
                        if (i.index == to) {
                            // if yes, inc the node
                            existed = true;
                            let condition = {
                                round_id: round_id, index: from
                            };
                            condition[dir + '.index'] = to;
                            let temp = {};
                            temp[dir + '.$.sup_num'] = 1;
                            NodeModel.update(condition,
                                { $inc: temp },
                                function (err, doc) {
                                    if (err) {
                                        console.log(err);
                                    }
                                });
                        }
                    }
                    // if not, push a new one
                    if (!existed) {
                        // ++
                        let temp = {};
                        temp[dir] = {
                            index: to,
                            sup_num: 1
                        };
                        NodeModel.update(
                            { round_id: round_id, index: from },
                            { $push: temp },
                            function (err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                    }
                }
            }
        }
    });
}


/**
 * Bidirectionally remove one link to the other side
 */
function biRemove(round_id, from, to, dir) {
    NodeModel.findOne({ round_id: round_id, index: from }, function(err, doc){
        if(err){
            console.log(err);
        }else{
            if(!doc){
                // it's sure that it exists
                if (doc[dir].length > 0) {
                    // --/-
                    let condition = {
                        round_id: round_id, index: from
                    };
                    condition[dir + '.index'] = to;
                    let temp = {};
                    temp[dir + '.$.sup_num'] = -1;
                    temp[dir + '.$.opp_num'] = 1;
                    NodeModel.findOneAndUpdate(condition,
                        { $inc: temp }, { new: true },
                        function (err, doc) {
                            if (err) {
                                console.log(err);
                            }
                        });
                }
            }
        }
    });
}

/**
 * Check the links and format the action object
 * Bidirectionally
 */
router.route('/check').all(LoginFirst).post(function (req, res, next) {
    let round_id = req.body.round_id;
    var NAME = req.session.user.username;

    let selected = req.body.selectedTile;
    let around = JSON.parse(req.body.aroundTiles);
    let msgs = new Array();
    // For every posted nodes, add them to the nodes(graph), and decide which way 
    var dirs = ['top', 'right', 'bottom', 'left'];
    var reverseDirs = ['bottom', 'left', 'top', 'right'];    
    NodeModel.findOne({ round_id: round_id, index: selected }, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (!doc) {
                // new a node and new the links
                // all ++
                let new_node = {
                    round_id: round_id,
                    index: selected
                };
                NodeModel.create(new_node, function (err) {
                    if (err) {
                        console.log(err);
                        res.send({ msg: err });
                    } else {
                        for (let d = 0; d < around.length; d++) { // d=0,1,2,3
                            let to = around[d];
                            if (to.before != to.after) {
                                // In practice, to.before is bound to be -1
                                if (to.before == -1) {
                                    let temp = {};
                                    temp[dirs[d]] = {
                                        index: to.after,
                                        sup_num: 1
                                    };
                                    NodeModel.update(
                                        { round_id: round_id, index: selected },
                                        { $push: temp },
                                        function (err) {
                                            if (err) {
                                                console.log(err);
                                            } else {
                                                writeAction(NAME, round_id, "++", selected, dirs[d], to.after);
                                                msgs.push('++ ' + selected + '-' + dirs[d] + '->' + to.after);
                                                biAdd(round_id, to.after, selected, reverseDirs[d]);
                                            }
                                        });
                                } else if (to.after == -1) {
                                    console.log("Unreachable case1.");
                                } else { // to.before!=to.after!=-1
                                    console.log("Unreachable case2.");
                                }
                            }
                        }
                        console.log(msgs);
                        // res.send({ msg: JSON.stringify(msgs) });
                    }
                });
            } else {
                // this node in this round already exists
                for (let d = 0; d < around.length; d++) { // d=0,1,2,3
                    let to = around[d];
                    if (to.before != to.after) {
                        if (to.before == -1) { // new link in user view
                            if (doc[dirs[d]].length == 0) {
                                // ++ in global view
                                let temp = {};
                                temp[dirs[d]] = {
                                    index: to.after,
                                    sup_num: 1
                                };
                                NodeModel.update(
                                    { round_id: round_id, index: selected },
                                    { $push: temp },
                                    function (err) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            writeAction(NAME, round_id, "++", selected, dirs[d], to.after);
                                            msgs.push('++ ' + selected + '-' + dirs[d] + '->' + to.after);
                                            biAdd(round_id, to.after, selected, reverseDirs[d]);                                    
                                        }
                                    });
                            } else {
                                let existed = false;
                                for (let i of doc[dirs[d]]) {
                                    if (i.index == to.after) {
                                        // + 
                                        existed = true;
                                        let condition = {
                                            round_id: round_id, index: selected
                                        };
                                        condition[dirs[d] + '.index'] = to.after;
                                        let temp = {};
                                        temp[dirs[d] + '.$.sup_num'] = 1;
                                        NodeModel.update(condition,
                                            { $inc: temp },
                                            function (err, doc) {
                                                if (err) {
                                                    console.log(err);
                                                } else {
                                                    writeAction(NAME, round_id, "+", selected, dirs[d], to.after);
                                                    msgs.push('+ ' + selected + '-' + dirs[d] + '->' + to.after);
                                                    biAdd(round_id, to.after, selected, reverseDirs[d]);                                    
                                                }
                                            });
                                    }
                                }
                                if (!existed) {
                                    // ++
                                    let temp = {};
                                    temp[dirs[d]] = {
                                        index: to.after,
                                        sup_num: 1
                                    };
                                    NodeModel.update(
                                        { round_id: round_id, index: selected },
                                        { $push: temp },
                                        function (err) {
                                            if (err) {
                                                console.log(err);
                                            } else {
                                                writeAction(NAME, round_id, "++", selected, dirs[d], to.after);
                                                msgs.push('++ ' + selected + '-' + dirs[d] + '->' + to.after);
                                                biAdd(round_id, to.after, selected, reverseDirs[d]);                                    
                                            }
                                        });
                                }
                            }
                        } else if (to.after == -1) {
                            // assert: existed&&sup_num>=1
                            if (doc[dirs[d]].length > 0) {
                                // --/-
                                let condition = {
                                    round_id: round_id, index: selected
                                };
                                condition[dirs[d] + '.index'] = to.before;
                                let temp = {};
                                temp[dirs[d] + '.$.sup_num'] = -1;
                                temp[dirs[d] + '.$.opp_num'] = 1;
                                NodeModel.findOneAndUpdate(condition,
                                    { $inc: temp }, { new: true },
                                    function (err, doc) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            let op = '';
                                            for (let i of doc[dirs[d]]) {
                                                if (i.index == to.before) {
                                                    op = i.sup_num <= 0 ? '-- ' : '- ';
                                                }
                                            }
                                            writeAction(NAME, round_id, op, selected, dirs[d], to.before);
                                            msgs.push(op + selected + '-' + dirs[d] + '->' + to.before);
                                            biRemove(round_id, to.before, selected, reverseDirs[d]);
                                        }
                                    });
                            }
                        } else { // to.before!=to.after!=-1
                            // - 
                            var to_send = {};
                            let condition = {
                                round_id: round_id, index: selected
                            };
                            condition[dirs[d] + '.index'] = to.before;
                            let temp = {};
                            temp[dirs[d] + '.$.sup_num'] = -1;
                            temp[dirs[d] + '.$.opp_num'] = 1;
                            NodeModel.findOneAndUpdate(condition,
                                { $inc: temp }, { new: true },
                                function (err, doc) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        let op = '';
                                        for (let i of doc[dirs[d]]) {
                                            if (i.index == to.before) {
                                                op = i.sup_num <= 0 ? '-- ' : '- ';
                                            }
                                        }
                                        writeAction(NAME, round_id, op, selected, dirs[d], to.before);
                                        msgs.push(op + selected + '-' + dirs[d] + '->' + to.before);
                                        biRemove(round_id, to.before, selected, reverseDirs[d]);                                        
                                    }
                                });
                            // +
                            let existed = false;
                            for (let i of doc[dirs[d]]) {
                                if (i.index == to.after) {
                                    existed = true;
                                    let condition = {
                                        round_id: round_id, index: selected
                                    };
                                    condition[dirs[d] + '.index'] = to.after;
                                    let temp = {};
                                    temp[dirs[d] + '.$.sup_num'] = 1;
                                    NodeModel.update(condition,
                                        { $inc: temp },
                                        function (err, doc) {
                                            if (err) {
                                                console.log(err);
                                            } else {
                                                msgs.push('+ ' + selected + '-' + dirs[d] + '->' + to.after);
                                                writeAction(NAME, round_id, "+", selected, dirs[d], to.after);
                                                biAdd(round_id, to.after, selected, reverseDirs[d]);                                                                                    
                                            }
                                        });
                                }
                            }
                            if (!existed) {
                                // ++
                                let temp = {};
                                temp[dirs[d]] = {
                                    index: to.after,
                                    sup_num: 1
                                };
                                NodeModel.update(
                                    { round_id: round_id, index: selected },
                                    { $push: temp },
                                    function (err) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            msgs.push('++ ' + selected + '-' + dirs[d] + '->' + to.after);
                                            writeAction(NAME, round_id, "++", selected, dirs[d], to.after);
                                            biAdd(round_id, to.after, selected, reverseDirs[d]);                                                                                                                                
                                        }
                                    });
                            }
                        }
                    }
                }
            }
            console.log(msgs);
            // res.send({ msg: JSON.stringify(msgs) });
        }
    });
});


/**
 * Get hints from the current graph data
 * @return an array of recommended index, in 4 directions of the tile
 */
router.route('/getHints/:round_id/:selected').all(JoinRoundFirst).get(function (req, res) {
    // router.route('/getHints/:round_id/:selected').get(function (req, res) { // 4 Test
    // query the 4 dirs of the selected tile
    let condition = {
        round_id: req.params.round_id,
        index: req.params.selected
    };
    // find the most-supported one of every dir
    var hintIndexes = new Array();
    var dirs = ['top', 'right', 'bottom', 'left'];

    // Stratey1: conservative
    // get the players_num of the round
    // RoundModel.findOne(condition,{_id:0, players_num:1}, function(err, doc){
    //     if(err){
    //         console.log(err);
    //     }else{
    //         let players_num=doc.players_num;
    //         NodeModel.findOne(condition, function (err, doc) {
    //             if (err) {
    //                 console.log(err);
    //             } else {
    //                 if (!doc) {
    //                     res.send({ msg: "No hints." });
    //                 } else {
    //                     for (let d = 0; d < 4; d++) {
    //                         let alternatives = doc[dirs[d]];
    //                         if (alternatives.length == 0) {
    //                             hintIndexes.push(-1);
    //                         } else {
    //                             let most_sup = alternatives[0];
    //                             for (let a of alternatives) {
    //                                 if (a.sup_num > most_sup.sup_num) {
    //                                     most_sup = a;
    //                                 }
    //                             }
    //                             // to guarantee zero sup nodes won't be hinted
    //                             // 1/5 of the crowd have supported
    //                             if (most_sup.sup_num > (players_num/5)) {
    //                                 hintIndexes.push(most_sup.index);
    //                             } else {
    //                                 hintIndexes.push(-1);
    //                             }
    //                         }
    //                     }
    //                     res.send(JSON.stringify(hintIndexes));
    //                 }
    //             }
    //         });
    //     }
    // }); 
    // Strategy 3: considerate
    NodeModel.findOne(condition, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (!doc) {
                res.send({ msg: "No hints." });
            } else {
                for (let d = 0; d < 4; d++) {
                    let alternatives = doc[dirs[d]];
                    if (alternatives.length == 0) {
                        hintIndexes.push(-1);
                    } else {
                        let best = alternatives[0];
                        for (let a of alternatives) {
                            if ((a.sup_num - a.opp_num) > 0 && (a.sup_num - a.opp_num) > (best.sup_num - best.opp_num)) {
                                best = a;
                            }
                        }
                        // to guarantee zero sup nodes won't be hinted
                        // 1/5 of the crowd have supported
                        if ((best.sup_num - best.opp_num) > 0) {
                            hintIndexes.push(best.index);
                        } else {
                            hintIndexes.push(-1);
                        }
                    }
                }
                res.send(JSON.stringify(hintIndexes));
            }
        }
    });

});


function LoginFirst(req, res, next) {
    if (!req.session.user) {
        req.session.error = 'Please Login First!';
        return res.redirect('/login');
        //return res.redirect('back');//返回之前的页面
    }
    next();
}

/**
 * Access Control
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
function JoinRoundFirst(req, res, next) {

    RoundModel.findOne({ round_id: req.params.round_id }, { _id: 0, players: 1 }, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            if (doc) {
                let hasJoined = doc.players.some(function (p) {
                    return (p.player_name == req.session.user.username);
                });
                if (!hasJoined) {
                    req.session.error = "You haven't joined this Round!";
                    return res.redirect('/home');
                }
                next();
            } else {
                return res.redirect('/home');
            }
        }
    });
}



module.exports = router;
