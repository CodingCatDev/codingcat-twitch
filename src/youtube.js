"use strict";
require("dotenv").config();
const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GAPI_CLIENT_ID,
  process.env.GAPI_CLIENT_SECRET,
  process.env.GAPI_REDIRECT_URI
);
oauth2Client.setCredentials({
  refresh_token: process.env.GAPI_YOUTUBE_REFRESH_TOKEN,
});

const youtube = google.youtube({
  version: "v3",
  auth: oauth2Client,
});

// Save this if you need a new token
// async function getTokenCode() {
//   const oauth2Client = new google.auth.OAuth2(
//     "67840007708-ueorlqaa4h7pg397vf4q3a7l6ilk3s1t.apps.googleusercontent.com",
//     "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",
//     "http://localhost:9797/oauth2callback"
//   );
//   const scopes = [
//     "profile",
//     "email",
//     "https://www.googleapis.com/auth/youtube", // <-- sensitive scope
//   ];
//   const url = oauth2Client.generateAuthUrl({
//     access_type: "offline",
//     scope: scopes,
//   });
// console.log(url);
// }

async function getBroadcasts() {
  const broadcastsRes = await youtube.liveBroadcasts.list({
    part: "snippet,contentDetails,status",
    broadcastStatus: "active",
    broadcastType: "all",
    // mine: true,
  });
  console.log(broadcastsRes);
  return broadcastsRes?.data?.items || [];
}

async function getLiveChat(liveChatId) {
  const liveChatMessagesRes = await youtube.liveChatMessages.list({
    liveChatId,
    part: "id, snippet, authorDetails",
  });
  console.log(liveChatMessagesRes);
  return liveChatMessagesRes?.data?.items || [];
}

async function streamLiveChat() {
  const broadcasts = await getBroadcasts();
  let chat = [];
  broadcasts.filter(b => b?.liveChatId).map(b => {
    const liveChat = await getLiveChat(b.liveChatId);
    chat = [...chat, liveChat]
  });
}

if (module === require.main) {
  runSample().catch(console.error);
}
module.exports = runSample;
