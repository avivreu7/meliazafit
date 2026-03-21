import { GoogleGenerativeAI } from "@google/generative-ai";

// Server-only module. Never import from client components.
// Always returns a blessing — never throws. Uses fallback on any error.
export async function generateBlessing(
  chametz: string,
  whyLetGo: string,
  newInvitation: string,
  userName: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Gemini] GEMINI_API_KEY not set, using fallback");
    return getFallbackBlessing();
  }

  const prompt = `
אתה מנחה רוחני ופייטן בסדנת ביעור חמץ רגשי לתלמידים בפסח.
כתוב ברכה אישית ופואטית (1-2 משפטים בלבד) בעברית עשירה.

שם: ${userName}
מה הוא/היא שורפים: "${chametz}"
מדוע: "${whyLetGo}"
מה הם מזמינים במקום: "${newInvitation}"

הנחיות:
- התייחס ישירות לחמץ שהם שורפים ולמה שהם מזמינים
- השתמש במטאפורות של אש, ביעור, פסח, חירות, חופש, ואביב
- הברכה תהיה חמה, אישית, מעצימה — כאילו נכתבה רק עבורם
- אל תכתוב יותר מ-2 משפטים
- אל תכלול שם מודל, כוכביות, כותרות או הסברים — רק הברכה עצמה
`.trim();

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) {
      console.warn("[Gemini] Empty response, using fallback");
      return getFallbackBlessing();
    }
    return text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota =
      msg.includes("429") ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("resource_exhausted") ||
      msg.toLowerCase().includes("rate limit");
    console.warn(`[Gemini] ${isQuota ? "Quota exceeded" : "Error"} — using fallback. ${msg.slice(0, 120)}`);
    return getFallbackBlessing();
  }
}

// Fallback blessings — poetic, personal, Passover-themed
const FALLBACK_BLESSINGS = [
  "כשם שהאש מבערת את החמץ ומשאירה רק אפר — כך יישרף מה שכבד עליך ותצא לחופשי, קל ומחודש כאביב. 🔥",
  "כמו שעם ישראל עבר את הים הנפתח לפניו — כך ייפתח לפניך שביל חדש אל מה שהזמנת. ✨",
  "האש שאתה/את מדליק/ה היום אינה הורסת — היא מטהרת, ומה שישאר ממנה הוא רק הזהב שבך. 🌟",
  "פסח הזה הוא לא רק חופש ממצרים — הוא חופש ממה שסגר אותך; תצא בראש מורם. 💛",
  "יהי רצון שמה ששרפת היום יישאר בעשן, ומה שהזמנת יגיע אליך כבר בחג הבא. 🌸",
  "הביעור הזה הוא מתנה שאתה/את נותן/ת לעצמך — שנה הקרובה תהיה קלה, פנויה ומוארת. ✡",
  "כשם שהפסח בא בכל שנה מחדש ומחדש את הבריאה — כך אתה/את מתחדש/ת היום, ממש עכשיו. 🌺",
  "מה שהעלית לאש היה כבד על ליבך — ועכשיו לבך פנוי לקבל את מה שביקשת, בשמחה ובשלום. 🕊️",
  "האש הזאת ראתה את אמץ ליבך — ומה שתזמין במקום כבר בדרך אליך, כי בחרת בו בכנות. 💫",
  "בפסח יוצאים מעבדות לחירות — ואתה/את בחרת היום לצאת חופשי/ה ממה שעצר אותך. חג שמח. 🔥",
  "כמו הניצוץ שעולה מהמדורה ומגיע עד לכוכבים — כך הכוונה שלך עולה ומגיעה גבוה. ✨",
  "שנה של קלות, שנה של אור — ממש כמו שביקשת בלב שלם. חג פסח שמח ומשחרר! 🌟",
];

export function getFallbackBlessing(): string {
  return FALLBACK_BLESSINGS[Math.floor(Math.random() * FALLBACK_BLESSINGS.length)];
}
