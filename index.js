// This is a rudemetary discord speech to text bot that took way too long to make 
// I apologize for what you are about to witness

const Discord = require("discord.js");
const fs = require('fs');

const path = require('path');


const client = new Discord.Client();

// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');

// Creates a client
const clientS = new speech.SpeechClient();

// the  authentication file
// should have the prefix and token
const config = require('./auth.json');

// currently used to turn the stereo to mono audio
let ffmpeg = require('fluent-ffmpeg');

// Discord's audio format
const encoding = 'LINEAR16';
const sampleRateHertz = 48000;
const languageCode = 'en-US';

// to queues to keep track of shit cause I don't know how to node.js enough to properly sync them :/
// area of improvement
let cnt = 0;
let q = [];
let q2 = [];

// where the audio files are being stored
const directory = 'audio';

client.on('message', msg => {
  if (msg.content.startsWith(config.prefix + 'c')) {
    const voiceChannel = msg.member.voice.channel;
    //console.log(voiceChannel.id);

    voiceChannel.join()
      .then(conn => {

        // So to even begin this opperation we need to send something to the discord gateway
        // so I just sent a silent sound file
        conn.play('meme.mp3');
        // create our voice receiver
        let receiver = conn.receiver;

        conn.on('speaking', (user, speaking) => {
          cnt++;
          q.push(cnt);

          if (speaking) {

            // this creates a 16-bit signed PCM, stereo 48KHz PCM stream.
            let audioStream = receiver.createStream(user, { mode: 'pcm' });

            // not all the audio is good
            // try to optimize by checking which audio files actually have content
            audioStream.pipe(fs.createWriteStream(`${directory}/${cnt}user_audio`));

            //console.log(cnt);
            //console.log(q);
            //console.log(q2);


            audioStream.on('end', () => {
              console.log(`stop listening`);

              // turn it into mono audio cause google cloud doesn't support stereo 
              // and as far as I know doesn't give me a way to make the change directly
              // Turning pcm stereo into mono should be on the simpler side 
              // (one method is to go 2 by two averaging the values)
              // this is a future improvent
              // frankly this whole work around is really dumb
              ffmpeg(`${directory}/${q[0]}user_audio`).inputOptions(['-f s16le', '-ar 48.0k', '-ac 2']).outputOptions(['-ac 1']).output(`${directory}/${q[0]}user_audio.wav`).on('end', function () {


                //console.log(`Finished processing ${q[0]}`);


                q2.push(q.shift());

                // I'm not handleling all the promises so that may cause issues
                trans(`${directory}/${q2[0]}user_audio.wav`, function () {
                  q2.shift();
                });

              }).run();

            });

          }
        });
      })
      .catch(console.log);
  }
  // disconnect for voice channel
  if (msg.content.startsWith(config.prefix + 'dc')) {
    let [command, ...channelName] = msg.content.split(" ");
    let voiceChannel = msg.member.voice.channel;
    voiceChannel.leave();
    // remove the audio files
    removeSoundFiles(directory);

  }
});

// login
client.login(config.token);

// just notifiy when ready
client.on('ready', () => {
  console.log('ready!');
});

// translate the speech to text
async function trans(filename, _callback) {

  const config = {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
  };

  const audio = {
    content: fs.readFileSync(filename).toString('base64'),
  };

  const request = {
    config: config,
    audio: audio,
  };

  // Attempts to detect speech in the provided sound file
  const [response] = await clientS.recognize(request);
  const transcription = response.results
    .map(result => result.alternatives[0].transcript)
    .join('\n');
  console.log('Transcription: ', transcription);

  _callback();

}

// removes all the files from a directory
// used primarily to remove all the audio files
function removeSoundFiles(directory) {
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), err => {
        if (err) throw err;
      });
    }
  });
}
