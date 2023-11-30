var util = require('util');
var mqtt = require('mqtt');
var ModbusRTU = require("modbus-serial");
var Parser = require('binary-parser').Parser;
const commandLineArgs = require('command-line-args')
var errorCounter = 0;

const optionDefinitions = [
	{ name: 'mqtthost', alias: 'm', type: String, defaultValue: "localhost" },
	{ name: 'mqttclientid', alias: 'c', type: String, defaultValue: "haierhpClient" },
	{ name: 'heatpumphost', alias: 'h', type: String, defaultValue: "tasmota-E556A0-5792" },
	{ name: 'heatpumpport', alias: 'p', type: String },
	{ name: 'name', alias: 'n', type: String, defaultValue: "greenhouse" },
	{ name: 'wait', alias: 'w', type: Number, defaultValue: 10000 },
	{ name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
];

const options = commandLineArgs(optionDefinitions)

var HuaweiSerialNumber = [];
var modbusClient = new ModbusRTU();


if (options.heatpumphost) {
	modbusClient.connectTcpRTUBuffered(options.heatpumphost, { port: 502 }).then(val => {
		getHaierHPRegisters(options.name);
	}).catch((error) => {
		console.error(error);
		process.exit(-1);
	});
} else if (options.heatpumpport) {
	modbusClient.connectRTUBuffered(options.heatpumpport, { baudRate: 9600, parity: 'none' }).then(val => {
		getHaierHPRegisters(options.name);
	}).catch((error) => {
		console.error(error);
		process.exit(-1);
	});
}

console.log("MQTT Host           : " + options.mqtthost);
console.log("MQTT Client ID      : " + options.mqttclientid);

if (options.heatpumphost) {
	console.log("Haier HP host       : " + options.heatpumphost);
} else {
	console.log("Haier HP serial port: " + options.heatpumpport);
}

var MQTTclient = mqtt.connect("mqtt://" + options.mqtthost, { clientId: options.mqttclientid });
MQTTclient.on("connect", function () {
	console.log("MQTT connected");
})

MQTTclient.on("error", function (error) {
	console.log("Can't connect" + error);
	process.exit(1)
});

function sendMqtt(id, data) {
	if (options.debug) {
		console.log("publish: " + 'Haier/' + id, JSON.stringify(data));
	}
	MQTTclient.publish('Haier/' + id, JSON.stringify(data));
}

const HaierHPPayloadParser = new Parser()
	.uint16be('Status')
	.uint16be('LastError')
	.int16be('PdTemp', { formatter: (x) => {return x/10.0;}})
	.int16be('Register3')
	.int16be('Register4')
	.int16be('Register5')
	.int16be('targetTemp', { formatter: (x) => {return x/10.0;}})
	.int16be('Twi', { formatter: (x) => {return x/10.0;}})
	.int16be('Two_', { formatter: (x) => {return x/10.0;}})
	.int16be('CompressorCurrent', { formatter: (x) => {return x/10.0;}})
	.int16be('Tao', { formatter: (x) => {return x/10.0;}})
	.int16be('Tz', { formatter: (x) => {return x/10.0;}})
	.int16be('Register12')
	.int16be('Register13')
	.int16be('Register14')
	.int16be('Pd', { formatter: (x) => {return x/100.0;}})
	.int16be('Ps', { formatter: (x) => {return x/100.0;}})
	;

function getHaierHPRegisters() {
	modbusClient.setID(1);
	modbusClient.setTimeout(1000);
	modbusClient.readHoldingRegisters(0, 17).then(function (vals) {
		console.log(util.inspect(vals.buffer.length));
		var gwState = HaierHPPayloadParser.parse(vals.buffer);
		if (options.debug) {
			console.log(util.inspect(gwState));
		}
		sendMqtt(options.name, gwState);
		errorCounter = 0;
	}).catch(function (e) {
		if (options.debug) {
			console.log(e);
		}
		errorCounter++;
		if (errorCounter > 10) {
			process.exit(-1);
		}
		return null;
	});
	setTimeout(getHaierHPRegisters, options.wait);
}
