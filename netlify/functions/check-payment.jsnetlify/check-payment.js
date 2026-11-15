const crypto = require("crypto");

const WALLET = "0xd0ff7afda86f17D8A7dF4012b803722A99e00c00".toLowerCase();
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const AMOUNT = "500000000000000000"; // 0.5 USDT, 18 знаков
const MAX_AGE_SEC = 60 * 60; // учитываем переводы за последний час

const reply = (code, body) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

function validInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  return calc === hash;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return reply(200, {});
  if (event.httpMethod !== "POST") return reply(405, { error: "POST only" });

  const { BOT_TOKEN, BSCSCAN_KEY } = process.env;
  let initData = "";
  try { initData = JSON.parse(event.body).initData || ""; } catch (e) {}

  if (!initData || !validInitData(initData, BOT_TOKEN)) {
    return reply(403, { error: "bad initData" });
  }

  const url =
    "https://api.bscscan.com/api?module=account&action=tokentx" +
    `&contractaddress=${USDT_BSC}&address=${WALLET}` +
    `&page=1&offset=50&sort=desc&apikey=${BSCSCAN_KEY}`;

  const res = await fetch(url);
  const data = await res.json();
  const list = Array.isArray(data.result) ? data.result : [];
  const now = Math.floor(Date.now() / 1000);

  const found = list.some(
    (t) =>
      t.to.toLowerCase() === WALLET &&
      t.value === AMOUNT &&
      now - Number(t.timeStamp) < MAX_AGE_SEC
  );

  if (!found) return reply(200, { paid: false });

  let order = "";
  for (let i = 0; i < 12; i++) order += crypto.randomInt(0, 10);
  return reply(200, { paid: true, order });
};
