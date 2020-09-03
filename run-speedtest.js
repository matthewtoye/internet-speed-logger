/* eslint-disable no-console */
const config = require('config');
const { exec } = require('child_process');
const dbInit = require('./db');

// Get the command to execute
const cmd = config.get('speedtest.commandString');
// Timing related constants
const minimumIntervalS = 60;
// const intervalS = Math.max(config.get('speedtest.intervalSec'), minimumIntervalS);
const intervalS = Math.max(process.argv[3], minimumIntervalS);
const intervalMS = intervalS * 1000;

const PingTest = false;
const SpeedTest = true;

if (process.argv[4] >= 0) {
	PingTest = true;
	SpeedTest = false;
}

const isDaemon = process.argv[2] === 'daemon';

function getDelay(interval) {
  return Math.floor(interval * (Math.random() * 0.5 + 0.75));
}

function insertData(result) {
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
		thistime = `date +%Y-%m-%dT%H:%M:%SZ`;
		console.log("date is: " + thistime + " ping: " + averagePing);
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
		exec("ping -c 5 speedtest.net", processOutput);
	} else {
		exec(cmd, processOutput);
	}
}

executeTest();
