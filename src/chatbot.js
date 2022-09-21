const tmi = require("tmi.js");
const {
  parseAuthor,
  parseCommand,
  parseEmotes,
  getMessageHTML,
} = require("./util/parse-twitch-chat");
const { logger } = require("./logger");
const { getCommandsForChannel } = require("./commands");
const { urlencoded } = require("body-parser");
const { StaticAuthProvider } = require("twitch-auth");
const authProvider = new StaticAuthProvider(
  process.env.TWITCH_OAUTH, // This is the token from https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#oauth-client-credentials-flow
  process.env.TWITCH_BOT_USER
);

const clients = new Map();

function getChatClient(channel) {
  let client;
  if (clients.has(channel)) {
    logger.debug(`loading an existing connection for ${channel}`);
    client = clients.get(channel);
  } else {
    logger.debug(`creating a new connection for ${channel}`);
    client = new tmi.Client({
      options: { debug: true, messagesLogLevel: "info" },
      connection: {
        secure: true,
        reconnect: true,
      },
      authProvider,
      channels: [channel],
    });

    client.on("disconnected", () => {
      logger.debug(`${channel} disconnected!`);
      clients.delete(client);
    });

    clients.set(channel, client);
  }

  if (client.readyState() === "OPEN") {
    logger.debug(`client is already connected for ${channel}!`);
    return client;
  }

  if (!["CONNECTING", "OPEN"].includes(client.readyState())) {
    client.connect();
  }

  return client;
}

exports.createChatBot = async (pubsub, subChannel) => {
  logger.debug("creating a new chatbot client");
  const client = getChatClient(subChannel);

  logger.debug(`client is ${client.readyState()}`);

  // since every page load creates a new connection (and, thus, a new chatbot),
  // remove previous listeners before adding new ones
  client.removeAllListeners();

  function handleSubscription(channel, _username, _method, msg, meta) {
    const time = new Date(parseInt(meta["tmi-sent-ts"]));

    const message = {
      channel: channel.replace("#", ""),
      message: msg || "",
      author: parseAuthor(channel, meta),
      emotes: parseEmotes(msg, meta.emotes),
      time,
      id: meta.id,
      type: "SUBSCRIPTION",
      details: meta["system-msg"],
    };

    pubsub.publish("MESSAGE", { message });
  }

  // https://github.com/tmijs/docs/blob/gh-pages/_posts/v1.4.2/2019-03-03-Events.md#subscription
  client.on("subscription", handleSubscription);
  client.on("resub", handleSubscription);

  // https://github.com/tmijs/docs/blob/gh-pages/_posts/v1.4.2/2019-03-03-Events.md#subgift
  client.on("subgift", handleSubscription);

  function TODO(event) {
    return (...payload) => {
      // uncomment to see paylaods
      console.log({ type: event, payload });
    };
  }

  // TODO handle gift subs
  // https://github.com/tmijs/docs/blob/gh-pages/_posts/v1.4.2/2019-03-03-Events.md#anongiftpaidupgrade
  // https://github.com/tmijs/docs/blob/gh-pages/_posts/v1.4.2/2019-03-03-Events.md#giftpaidupgrade
  client.on("anongiftpaidupgrade", TODO("anongiftpaidupgrade"));
  client.on("giftpaidupgrade", TODO("giftpaidupgrade"));

  // TODO handle bits
  // https://github.com/tmijs/docs/blob/gh-pages/_posts/v1.4.2/2019-03-03-Events.md#cheer
  client.on("cheer", TODO("cheer"));

  // TODO handle raids
  // https://github.com/tmijs/docs/blob/gh-pages/_posts/v1.4.2/2019-03-03-Events.md#raided
  client.on("raided", TODO("raided"));

  client.on("message", (channel, meta, msg, self) => {
    // don’t process messages sent by the chatbot to avoid loops
    if (self) return;

    if (meta["message-type"] === "whisper") {
      // we don’t handle whispers
      return;
    }

    console.log("channel:", channel);
    console.log("meta:", JSON.stringify(meta));
    console.log("msg:", JSON.stringify(msg));

    // chat activity always includes author and emote data
    const time = new Date(parseInt(meta["tmi-sent-ts"]));

    const message = {
      channel: channel.replace("#", ""),
      message: msg,
      author: parseAuthor(channel, meta),
      emotes: parseEmotes(msg, meta.emotes),
      time,
      id: meta.id,
    };

    if (msg.startsWith("!")) {
      // TODO check if this command is in a cooldown period before sending
      const { command, args } = parseCommand(msg);

      message.command = command;
      message.args = args;

      if (command === "showcommands") {
        handleShowCommands();
      }
    } else {
      message.html = getMessageHTML(msg, message.emotes);
    }

    pubsub.publish("MESSAGE", { message });
  });
};

const handleShowCommands = async () => {
  const cs = await getCommandsForChannel();
  const goodCommands = cs.map((c) => `!${c.command}`);
  this.sendMessage({
    channel: "codingcatdev",
    message: `> ${goodCommands.join(" | ")}`,
  });
};

exports.sendMessage = async ({ channel, message }) => {
  if (!channel || !message) return;
  logger.info({ channel, message });

  const client = await getChatClient(channel);

  client.say(channel, message);
};
