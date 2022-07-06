const fetch = require("node-fetch");
const { logger } = require("./logger");

const API =
  process.env.NODE_ENV === "production"
    ? process.env.API
    : "http://localhost:3000/api/";

console.log("process.env.API", process.env.API);
console.log("API", API);

async function getCommandsForChannel(channel) {
  const effects = [
    {
      command: "adult",
      handler: "adult",
    },
    {
      command: "behold",
      handler: "behold",
    },
    {
      command: "jamstack",
      handler: "jamstack",
    },
    {
      command: "so",
      handler: "shout-out",
    },
  ];

  return effects;
}

exports.getCommands = async (channel) => {
  const commands = await getCommandsForChannel(channel);
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
  const commands = await getCommandsForChannel(channel);
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
