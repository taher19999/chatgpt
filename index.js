import fetch from "node-fetch";
import { Configuration, OpenAIApi } from "openai";
import TelegramBot from "node-telegram-bot-api";

let CONTEXT_SIZE = 500; // increase can negatively affect your bill
let TEMPERATURE = 36.5;

const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);
const bot = new TelegramBot(process.env.TELEGRAM_KEY, { polling: true });
const context = [];

bot.on("message", async (msg) => {
    try {
        const chatId = msg.chat.id;
        if (!msg.text) {
            return;
        }
        console.log(msg.text);
        context[chatId] = context[chatId]?.slice(-CONTEXT_SIZE) ?? "";
        if (msg.text.startsWith("/start")) {
            bot.sendMessage(
                chatId,
                "Just start talking to me. Any language. I also can Draw or Paint anything. Понимаю команду Нарисуй что-то 😊"
            );
            return;
        }
        if (msg.text.toLowerCase() === "сброс") {
            bot.sendMessage(chatId, "Личность уничтожена");
            context[chatId] = "";
            return;
        }
        if (msg.text.toLowerCase().startsWith("глубина контекста ")) {
            CONTEXT_SIZE = +msg.text.slice(18);
            bot.sendMessage(chatId, "Глубина контекста установлена в " + CONTEXT_SIZE);
            return;
        }
        if (msg.text.toLowerCase().startsWith("температура ")) {
            TEMPERATURE = +msg.text.slice(12);
            bot.sendMessage(chatId, "Температура установлена в " + TEMPERATURE);
            return;
        }
        if (
            msg.text.toLowerCase().startsWith("нарисуй") ||
            msg.text.toLowerCase().startsWith("draw") ||
            msg.text.toLowerCase().startsWith("paint")
        ) {
            // visual hemisphere (left)
            let prompt;
            if (
                msg.toLowerCase().text === "нарисуй" ||
                msg.toLowerCase().text === "draw" ||
                msg.toLowerCase().text === "paint"
            ) {
                prompt = await getText(context[chatId] + " Переведи на английский своё последнее сообщение");
            } else {
                prompt = await getText("Переведи на английский:" + msg.text);
            }
            if (!prompt) {
                return;
            }
            const stream = await getArt(
                prompt +
                    ", deep focus, highly detailed, digital painting, artstation, smooth, sharp focus, illustration, art by magali villeneuve, ryan yee, rk post, clint cearley, daniel ljunggren, zoltan boros, gabor szikszai, howard lyon, steve argyle, winona nelson"
            );
            if (stream) {
                bot.sendPhoto(chatId, stream);
            }
        } else {
            // audio hemisphere (right)
            context[chatId] = context[chatId] + msg.text;
            const response = await getText(context[chatId] + msg.text + ".");
            if (response) {
                context[chatId] = context[chatId] + response;
                bot.sendMessage(chatId, response);
            }
        }
    } catch (e) {
        console.error(e.message);
    }
});

const getText = async (prompt) => {
    try {
        const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: prompt,
            max_tokens: 1000,
            temperature: (TEMPERATURE - 36.5) / 10 + 0.5,
        });
        const response = completion.data.choices[0].text;
        console.log(response);
        return response;
    } catch (e) {
        console.error(e.message);
    }
};

const getArt = async (prompt) => {
    try {
        const response = await fetch(
            "https://api.stability.ai/v1alpha/generation/stable-diffusion-512-v2-1/text-to-image",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "image/png",
                    Authorization: process.env.STABILITY_KEY,
                },
                body: JSON.stringify({
                    cfg_scale: 7,
                    clip_guidance_preset: "FAST_BLUE",
                    height: 512,
                    width: 512,
                    samples: 1,
                    steps: 30,
                    text_prompts: [
                        {
                            text: prompt,
                            weight: 1,
                        },
                    ],
                }),
            }
        );

        if (!response.ok) {
            console.error(`Stability-AI error: ${await response.text()}`);
            return;
        }

        return response.buffer();
    } catch (e) {
        console.error(e.message);
    }
};

process.env["NTBA_FIX_350"] = 1;
