const { encrypt, decrypt } = require("./encryption");
const dotenv = require("dotenv");
const { ContractAddress, User } = require("./db");
const { Telegraf } = require("telegraf");
const { tradeWithStrategy } = require("./trading");
dotenv.config();

// Replace with your values
const botToken = process.env.BOT_TOKEN;
const owner = process.env.TG_USERNAME;

let userSession = {};

const bot = new Telegraf(botToken);

bot.start((ctx) => {
  if (ctx.message.chat.type != "private") return;
  console.log(ctx.from.username)
  if (ctx.from.username != owner) return;
  userSession = { userId: ctx.from.id };
  ctx.reply(
    "Welcome! Please register your wallet using /register <PrivateKey>"
  );
});

bot.telegram.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "register", description: "Register your wallet" },
  {
    command: "strategy",
    description: "Register your trading strategy in JSON format with no space.",
  },
  { command: "help", description: "Show available commands" },
]);

bot.command("help", async (ctx) => {
  if (ctx.from.username != owner) return;
  ctx.reply(`
    /start - Start the bot\n/register <PrivateKey> - Register your wallet\n/strategy <Your Trading Strategy> - Input in JSON format with no space.
    `);
});

bot.command("register", async (ctx) => {
  try {
    if (ctx.message.chat.type != "private") return;
    if (ctx.from.username != owner) return;
    const privateKey = ctx.message.text.split(" ")[1];
    if (privateKey) {
      userSession = { userId: ctx.from.id };

      userSession.privateKey = encrypt(privateKey);
      ctx.reply(
        "PrivateKey is successfully registered.\nPlease provide your strategy in JSON format with no spacing."
      );
    } else {
      userSession = { userId: ctx.from.id };
      userSession.step = "register";
      ctx.reply("Please provide your privateKey");
    }
  } catch (error) {
    console.error(error.message);
  }
});

bot.command("strategy", async (ctx) => {
  try {
    if (ctx.message.chat.type != "private") return;
    if (ctx.from.username != owner) return;
    const strategy = ctx.message.text.split(" ")[1];
    if (strategy) {
      userSession.strategy = JSON.parse(strategy);
      const user = await User.findOne({ userId: ctx.from.id });
      if (user) {
        await User.updateOne({ userId: ctx.from.id }, userSession)
          .then(async () => {
            console.log("User session saved successfully");
            userSession = {}; // Reset user session
            ctx.reply("Your info saved successfully");
          })
          .catch((error) => {
            console.error("Error saving user session:", error.message);
          });
      } else {
        await User.create(userSession)
          .then(async () => {
            console.log("User session saved successfully");
            userSession = {}; // Reset user session
            ctx.reply("Your info saved successfully");
          })
          .catch((error) => {
            console.error("Error saving user session:", error.message);
          });
      }
    } else {
      userSession = { userId: ctx.from.id };
      userSession.step = "strategy";
      ctx.reply("Please provide your strategy");
    }
  } catch (error) {
    console.error(error.message);
  }
});

bot.on("channel_post", async (ctx) => {
  await tradeWithStrategy(ctx.channelPost.text);
});

bot.on("message", async (ctx) => {
  await tradeWithStrategy(ctx.message.text);
});

bot.launch();
