import { Telegraf, session } from "telegraf";
import fetch from "node-fetch";
import ChartJSImage from "chart.js-image";
const token = "1607918931:AAGLiYg1_cGJhAzwnEAn_qGodpsIgQOvQuU";
const bot = new Telegraf(token);

bot.use(session());
bot.start((ctx) => ctx.reply("Greetings! You can use /help to see commands."));
bot.help((ctx) =>
  ctx.reply(`Availible commands:

/list or /lst - returns list of all available rates

/exchange $YOUR_NUMBER(10) to YOUR_CURRENCY(CAD)\nor /exchange YOUR_NUMBER(10) USD to YOUR_CURRENCY(CAD) - converts to the second currency with two decimal precision and return. 

/history YOUR_CURRENCY(USD)/YOUR_CURRENCY(CAD) for YOUR_NUMBER(7) days - returns an image graph which shows the exchange rate of the selected currency for the last YOUR_NUMBER days.
`)
);
const getResource = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}, ${res.status}`);
  }
  return await res.json();
};

const listHandler = async (ctx) => {
  let differenceBetweenSeconds;

  if (ctx.session && ctx.session.list) {
    const seconds = Date.now();
    differenceBetweenSeconds = (
      (seconds - ctx.session.compareSeconds) /
      1000
    ).toFixed();
  }

  if (differenceBetweenSeconds < 600) {
    ctx.reply(ctx.session.list);
  } else {
    const res = await getResource(
      "https://api.exchangeratesapi.io/latest?base=USD"
    );
    const listOfNames = Object.keys(res.rates);
    const listOfValues = Object.values(res.rates).map((item) =>
      item.toFixed(2)
    );
    let list = "";
    listOfNames.map((item, idx) => {
      list += `${item}: ${listOfValues[idx]}\n`;
    });
    const compareSeconds = Date.now();
    ctx.session = { list, compareSeconds }; //saving data into storage

    ctx.reply(list);
  }
};
bot.command("list", listHandler);
bot.command("lst", listHandler);

const exchangeHandler = async (ctx) => {
  const convertAmount = ctx.match[1];
  const convertCurrency = ctx.match[2];
  const res = await getResource(
    `https://api.exchangeratesapi.io/latest?symbols=${convertCurrency}&base=USD`
  );
  const convertedValue = convertAmount * res.rates[convertCurrency];
  ctx.reply("$" + convertedValue.toFixed(2));
};

const historyHandler = async (ctx) => {
  const baseCurrency = ctx.match[1];
  const secondaryCurrency = ctx.match[2];
  const daysBetween = ctx.match[3];
  const endDate = new Date();
  const startDate = new Date(endDate - 86400000 * daysBetween);

  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;
  const endDay = endDate.getDate();
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const startDay = startDate.getDate();

  const res = await getResource(
    `https://api.exchangeratesapi.io/history?start_at=${startYear}-${startMonth}-${startDay}&end_at=${endYear}-${endMonth}-${endDay}&base=${baseCurrency}&symbols=${secondaryCurrency}
    `
  );
  if (res.rates.length < 2)
    ctx.reply("No exchange rate data is available for the selected currency.");
  else {
    const listOfDates = Object.keys(res.rates);
    const listOfValues = Object.values(res.rates).map((item) => {
      return item[secondaryCurrency].toFixed(3);
    });
    let chartData = [];
    listOfDates.map((item, idx) => {
      chartData.push(`${item}: ${listOfValues[idx]}`);
    });

    chartData.sort(
      (a, b) =>
        +new Date(a.slice(0, 11)).getTime() -
        +new Date(b.slice(0, 11)).getTime()
    );
    const labels = [...chartData].map((i) => i.slice(0, 10));
    const data = [...chartData].map((i) => i.slice(-5));

    const line_chart = ChartJSImage()
      .chart({
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: `${secondaryCurrency}`,
              borderColor: "rgb(255,+99,+132)",
              backgroundColor: "rgba(255,+99,+132,+.5)",
              data,
            },
          ],
        },
        options: {
          title: {
            display: false,
            text: ``,
          },
          scales: {
            xAxes: [
              {
                scaleLabel: {
                  display: true,
                  labelString: "date",
                },
              },
            ],
            yAxes: [
              {
                stacked: true,
                scaleLabel: {
                  display: true,
                  labelString: `${baseCurrency}/${secondaryCurrency}`,
                },
              },
            ],
          },
        },
      })
      .backgroundColor("white")
      .width(500)
      .height(300);
    bot.telegram.sendPhoto(ctx.chat.id, { url: line_chart.toURL() });
  }
};

bot.hears(/\/exchange \$(.+) to (.+)/, exchangeHandler);
bot.hears(/\/exchange (.+) USD to (.+)/, exchangeHandler);
bot.hears(/\/history (.+)\/(.+) for (.+) days/, historyHandler);

bot.launch();

// line_chart.toFile('/path/to/chart.png'); // Promise<()>
// line_chart.toDataURI(); // Promise<String> : data:image/png;base64,iVBORw0KGgo...
// line_chart.toBuffer(); // Promise<Buffer> : Buffer 89 50 4e 47 0d 0a 1a 0a 00 00 00 ...
