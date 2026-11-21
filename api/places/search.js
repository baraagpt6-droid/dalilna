"use strict";
const { server } = require("../../server");
module.exports = function placesSearch(req,res) { server.emit("request",req,res); };
module.exports.config = { maxDuration: 60 };
