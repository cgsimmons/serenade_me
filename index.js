/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/

"use strict";
const Alexa = require("alexa-sdk");
const request = require("request");
const parseString = require("xml2js").parseString;
const { filter: peepeeFilter } = require("./lib/profanity");

const APP_ID = process.env.APP_ID;
const SKILL_NAME = "SerenadeMe";
const WELCOME_MESSAGE = "Welcome to Serenade Me. ";
const HELP_MESSAGE =
    "I can recite song lyrics to you. Just give me the song title and artist. if you can't remember the artist, try using only the song title. I'll do my best to find the song. Now, try saying something like,  Sing \"Bad\", by Michael Jackson. ";
const HELP_REPROMPT = "What song would you like me to sing? ";
const STOP_MESSAGE = "Goodbye!";
const ERROR_MESSAGE =
    "Sorry, I was unable to find that song. Please speak more clearly or choose a better song.";

const handleError = function (context, message = ERROR_MESSAGE) {
    context.emit(":ask", message, HELP_REPROMPT);
};

const handleLyricLookup = function (artist, song, context) {
    const info = song + " by " + artist + "... ";
    request(
        `http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect?artist=${artist}&song=${song}`,
        (requestError, _response, body) => {
            if (requestError) {
                handleError(context);
                return;
            }

            parseString(body, (parseError, result) => {
                if (parseError) {
                    handleError(context);
                    return;
                }

                const lyrics = result.GetLyricResult.Lyric;

                if (
                    lyrics === undefined ||
                    lyrics === null ||
                    lyrics.length === 0 ||
                    lyrics[0].length === 0
                ) {
                    handleError(context);
                    return;
                }
                const strippedLyrics = String(lyrics)
                    .replace(/\r|\n/g, ".")
                    .replace(/\.[a-zA-Z]/g, (x) => x[0] + " " + x[1])
                    .replace(/\[[\s\S]*?\]/g, "")
                    .replace(/\'\'\'[\s\S]*?\'\'\'/g, "")
                    .replace(/CHORUS|VERSE/g, "")
                    .replace(peepeeFilter, "censored");

                console.log("Original Lyrics: ", lyrics);
                console.log("Filtered Lyrics: ", strippedLyrics);
                context.response.cardRenderer(SKILL_NAME, info + lyrics);
                context.response.speak(info + strippedLyrics);
                context.emit(":responseReady");
            });
        }
    );
};

const handleArtistLookup = function (song, context) {
    request(
        `https://itunes.apple.com/search?term=${song}`,
        (requestError, _response, body) => {
            let artist = null;

            if (requestError || body === undefined || body === null) {
                handleError(context);
                return;
            }

            try {
                const parsedBody = JSON.parse(body);
                artist =
                    parsedBody.results && parsedBody.results[0]
                        ? parsedBody.results[0] &&
                          parsedBody.results[0].artistName
                        : null;
            } catch (parseError) {
                handleError(context);
                return;
            }

            if (artist === undefined || artist === null) {
                handleError(context);
                return;
            }

            handleLyricLookup(artist, song, context);
        }
    );
};

const handlers = {
    LaunchRequest: function () {
        this.emit(":ask", WELCOME_MESSAGE + HELP_MESSAGE, HELP_REPROMPT);
    },
    serenadeMe: function () {
        const artistSlot = this.event.request.intent.slots.artist;
        const songSlot = this.event.request.intent.slots.song;

        const artist = artistSlot ? artistSlot.value : null;
        const song = songSlot ? songSlot.value : null;

        if (song === undefined || song === null) {
            handleError(this);
            return;
        }

        if (artist === undefined || artist === null) {
            handleArtistLookup(song, this);
        } else {
            handleLyricLookup(artist, song, this);
        }
    },
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", HELP_MESSAGE, HELP_REPROMPT);
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", STOP_MESSAGE);
    },
    "AMAZON.StopIntent": function () {
        this.emit(":tell", STOP_MESSAGE);
    },
    SessionEndedRequest: function () {
        console.log("session ended!");
    },
};

exports.handler = function (event, context, callback) {
    const alexa = Alexa.handler(event, context, callback);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
