const fetch = require("node-fetch");
const { logger } = require("./logger");

const API =
  process.env.NODE_ENV === "production"
    ? process.env.API
    : "http://localhost:3000/api/";

console.log("process.env.API", process.env.API);
console.log("API", API);

var admin = require("firebase-admin");
var { config } = require("./config/firebase");

admin.initializeApp({
  credential: admin.credential.cert(config),
  databaseURL: "https://codingcat-dev.firebaseio.com",
});

exports.getCommandsForChannel = async (channel) => {
  const commandsRef = await admin.firestore().doc(`overlays/alex`).get();
  const { commands } = commandsRef.data();

  return commands;
};

exports.getCommands = async (channel) => {
  const commands = await this.getCommandsForChannel(channel);
  if (!commands) {
    return [];
  }
  return commands.map(({ command }) => `!${command}`);
};

exports.getCommand = async ({
  channel,
  author,
  command,
  args,
  message: originalChatMessage,
}) => {
  const commands = await this.getCommandsForChannel(channel);
  if (!commands) {
    return null;
  }
  const cmd = commands.find((c) => c.command === command);

  logger.info({ cmd });

  if (!cmd) {
    return null;
  }

  try {
    const {
      name,
      message = null,
      description = "",
      audio = null,
      image = null,
      duration = 4,
    } = await fetch(`${API}${cmd.handler}`, {
      method: "POST",
      body: JSON.stringify({
        message: originalChatMessage,
        command,
        args,
        author,
        extra: {
          channel,
        },
      }),
    })
      .then((res) => res.json())
      .catch((err) => {
        logger.info({ err });
        throw new Error(err.message);
      });

    logger.info({
      name,
      message,
      description,
      audio,
      image,
      duration,
    });
    return {
      name,
      message,
      description,
      audio,
      image,
      duration,
    };
  } catch (error) {
    logger.info(error);
    return null;
  }
};
