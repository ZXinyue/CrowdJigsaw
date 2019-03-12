const mongoose=require("mongoose");

var UsergraphsSchema=new mongoose.Schema({
    round_id: { type: Number,required: true, index:true },
    user_name: {type: String,required: true},
    graph_s2: {type: Array},
    graph_s3: {type: Array},
    graph_s4: {type: Array},
    graph_s5: {type: Array},
    score: {type: Number},
    end_time: {type: String, default:"-1"},
    steps: { type: Number, default: -1 },
    time: { type: String, default: "-1" },
},
    { collection: 'usergraphs' });

console.log('[OK] usergraphs Schema Created.');

exports.Usergraphs = mongoose.model('Usergraphs', UsergraphsSchema);