/* eslint-disable no-console */
const config = require('config');
const { exec } = require('child_process');
const dbInit = require('./db');

// Get the command to execute
const cmd = config.get('speedtest.commandString');
// Timing related constants
const minimumIntervalS = 0;
// const intervalS = Math.max(config.get('speedtest.intervalSec'), minimumIntervalS);
const intervalS = Math.max(process.argv[3], minimumIntervalS);
const intervalMS = intervalS * 1000;

testServer = process.argv[7];
numberOfPings = process.argv[5];
pingTimout = process.argv[6];
PingTest = false;
SpeedTest = true;

if (process.argv[4] >= 0) {
	PingTest = true;
	SpeedTest = false;
}

if (!isNaN(numberOfPings)) {
	numberOfPings = 5;
}

if (!isNaN(pingTimout)) {
	pingTimout = 50;
}

const isDaemon = process.argv[2] === 'daemon';

function getDelay(interval) {
	if (PingTest) {
		return interval;
	} else {
		return Math.floor(interval * (Math.random() * 0.5 + 0.75));
	}
}

function insertData(result) {
	if (PingTest) {
		dbInit().then((dbs) => {
			const { timestamp } = result;
			const ping = result.ping.latency;
			const speedtestResult = {
			  date: new Date(timestamp), ping,
			};
			
			dbs.insertOne(speedtestResult, (err) => {
			  if (err) {
				console.error("ERROR: " + err);
			  }
			  if (!isDaemon) {
				process.exit();
			  }
			});
		}).catch((err) => {
			console.error('Failed to connect to mongo');
			console.error(err);
			process.exit(1);
		});
	}
	else {
		dbInit().then((dbs) => {
			const byteToMbit = 0.000008;
			const { timestamp } = result;
			const ping = result.ping.latency;
			const { jitter } = result.ping;
			const download = result.download.bandwidth * byteToMbit;
			const upload = result.upload.bandwidth * byteToMbit;
			console.log("Server used: " + result.server.name + " id: " + result.server.id);
			const speedtestResult = {
			  date: new Date(timestamp), ping, download, upload, jitter,
			};
		
			dbs.insertOne(speedtestResult, (err) => {
			  if (err) {
				console.error(err);
			  }
			  if (!isDaemon) {
				process.exit();
			  }
			});
		}).catch((err) => {
			console.error('Failed to connect to mongo');
			console.error(err);
			process.exit(1);
		});
	}
}

function buildTime() {
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth()+1; 
	var yyyy = today.getFullYear();
	var HH = today.getHours();
	var MM = today.getMinutes();
	var SS = today.getSeconds();
	if(dd<10) 
	{
		dd='0'+dd;
	} 

	if(mm<10) 
	{
		mm='0'+mm;
	} 

	if(HH<10) 
	{
		HH='0'+HH;
	}
	if(MM<10) 
	{
		MM='0'+MM;
	}
	if(SS<10) 
	{
		SS='0'+SS;
	}
	today = yyyy+'-'+mm+'-'+dd+'T'+HH+':'+MM+':'+SS+'Z';
	return today;
}

function processOutput(error, stdout, stderr) {
  if (error) {
    console.error('Error executing test');
    console.error(error);
  }
  if (stderr) {
    console.error(stderr);
  }
  try {
	if (PingTest) {
		averagePing = stdout.split("=");
		averagePing = averagePing[averagePing.length-1].split("/")[1];
		thistime = buildTime();
		//console.log("date is: " + thistime + " ping: " + averagePing);
		const data = {"type":"result","timestamp":thistime,"ping":{"latency":averagePing}};
		insertData(data);
	} else {
		const data = JSON.parse(stdout);
		insertData(data);
	}
  } catch (err) {
    console.error('Failed to connect to parse output');
    console.error(err);
  } finally {
    if (isDaemon) {
      // No matter if there is an error, re-schedule.
      // eslint-disable-next-line no-use-before-define
      const delay = getDelay(intervalMS);
      console.log(`Sleeping for ${Math.floor(delay / 1000)} seconds before next run...`);
      // eslint-disable-next-line no-use-before-define
      setTimeout(executeTest, delay);
    }
  }
}

function executeTest() {
	if (PingTest) {
		exec("ping -c " + numberOfPings + " -W " + pingTimout + " " + testServer, processOutput);
	} else {
		exec(cmd, processOutput);
	}
}

executeTest();
