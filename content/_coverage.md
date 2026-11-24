# Coverage map

The checklist the content tool works through. Format of each line:
`- [ ] folder/slug: English title / عنوان فارسی`. A box is ticked only when BOTH
`slug.md` and `slug.fa.md` exist and follow the page template. The audit
(`site/scripts/audit-content.mjs`) fails if a ticked page is missing or a page
exists that is not listed here. To add a topic, add a line first.

Page template (same headings in both languages): Definition, Why it matters,
How it works, Contested points, Examples, Sources, Further reading. Frontmatter:
`title`, `description`. Every factual claim has a source with an access date.

## foundations

- [x] foundations/what-is-politics: What is politics? / سیاست چیست؟
- [x] foundations/power-and-authority: Power and authority / قدرت و اقتدار
- [x] foundations/the-state: The state / دولت
- [x] foundations/legitimacy: Legitimacy / مشروعیت
- [x] foundations/civil-society: Civil society and public participation / جامعهٔ مدنی و مشارکت عمومی
- [x] foundations/political-ideologies: Political ideologies / ایدئولوژی‌های سیاسی
- [x] foundations/liberalism: Liberalism / لیبرالیسم
- [x] foundations/conservatism: Conservatism / محافظه‌کاری
- [x] foundations/socialism-and-social-democracy: Socialism and social democracy / سوسیالیسم و سوسیال‌دموکراسی
- [ ] foundations/nation-and-nationalism: Nation and nationalism / ملت و ناسیونالیسم
- [ ] foundations/populism: Populism / پوپولیسم
- [ ] foundations/authoritarianism-and-totalitarianism: Authoritarianism and totalitarianism / اقتدارگرایی و توتالیتاریسم
- [ ] foundations/anarchism: Anarchism / آنارشیسم
- [ ] foundations/fascism: Fascism / فاشیسم
- [ ] foundations/feminism-and-politics: Feminism and politics / فمینیسم و سیاست
- [ ] foundations/environmentalism: Political environmentalism / محیط‌زیست‌گرایی سیاسی
- [ ] foundations/religion-and-politics: Religion and politics / دین و سیاست
- [ ] foundations/secularism: Secularism / سکولاریسم
- [ ] foundations/left-and-right: Left and right / چپ و راست
- [ ] foundations/political-culture: Political culture / فرهنگ سیاسی
- [ ] foundations/political-theory-classics: Classic political thinkers / متفکران کلاسیک سیاست

## institutions

- [x] institutions/constitutions: Constitutions / قانون اساسی
- [x] institutions/elections-and-voting-systems: Elections and voting systems / انتخابات و نظام‌های رأی‌گیری
- [x] institutions/separation-of-powers: Separation of powers / تفکیک قوا
- [x] institutions/judiciary-and-courts: Judiciary and courts / قوهٔ قضائیه و دادگاه‌ها
- [x] institutions/parliaments-and-legislatures: Parliaments and legislatures / پارلمان‌ها و مجالس قانون‌گذاری
- [x] institutions/political-parties: Political parties / احزاب سیاسی
- [x] institutions/party-systems: Party systems / نظام‌های حزبی
- [x] institutions/political-regimes: Political regimes / رژیم‌های سیاسی
- [ ] institutions/presidential-and-parliamentary-systems: Presidential and parliamentary systems / نظام‌های ریاستی و پارلمانی
- [ ] institutions/federalism-and-unitary-states: Federalism and unitary states / فدرالیسم و دولت‌های یکپارچه
- [ ] institutions/local-government: Local government and decentralisation / حکومت محلی و تمرکززدایی
- [ ] institutions/bureaucracy: Bureaucracy and the civil service / دیوان‌سالاری و خدمات کشوری
- [ ] institutions/military-and-politics: The military and politics / ارتش و سیاست
- [ ] institutions/interest-groups-and-lobbying: Interest groups and lobbying / گروه‌های ذی‌نفع و لابی‌گری
- [ ] institutions/referendums-and-direct-democracy: Referendums and direct democracy / همه‌پرسی و دموکراسی مستقیم
- [ ] institutions/public-budget-and-taxes: Public budgets and taxes / بودجهٔ عمومی و مالیات
- [ ] institutions/corruption-and-accountability: Corruption and accountability / فساد و پاسخ‌گویی

## rights

- [x] rights/rights-and-rule-of-law: Rights and the rule of law / حقوق و حاکمیت قانون
- [ ] rights/human-rights-law: Human rights and international law / حقوق بشر و حقوق بین‌الملل
- [ ] rights/freedom-of-expression: Freedom of expression / آزادی بیان
- [ ] rights/minority-rights: Minority rights / حقوق اقلیت‌ها
- [ ] rights/gender-equality-and-law: Gender equality and the law / برابری جنسیتی و قانون
- [ ] rights/citizenship: Citizenship / شهروندی
- [ ] rights/protest-and-civil-disobedience: Protest and civil disobedience / اعتراض و نافرمانی مدنی
- [ ] rights/privacy-and-surveillance: Privacy and surveillance / حریم خصوصی و نظارت

## media

- [ ] media/how-news-is-made: How news is made / خبر چگونه ساخته می‌شود
- [ ] media/fact-and-opinion: Fact, opinion and analysis / واقعیت، نظر و تحلیل
- [ ] media/evaluating-sources: Evaluating sources / ارزیابی منابع
- [ ] media/bias-and-framing: Bias and framing / سوگیری و چارچوب‌بندی
- [ ] media/propaganda-and-disinformation: Propaganda and disinformation / پروپاگاندا و اطلاعات نادرست
- [ ] media/reading-polls-and-statistics: Reading polls and statistics / خواندن نظرسنجی‌ها و آمار
- [ ] media/social-media-and-politics: Social media and politics / شبکه‌های اجتماعی و سیاست
- [ ] media/press-freedom: Press freedom and censorship / آزادی مطبوعات و سانسور
- [ ] media/reading-a-political-speech: Reading a political speech / خواندن یک سخنرانی سیاسی

## economy

- [ ] economy/political-economy: Political economy / اقتصاد سیاسی
- [ ] economy/capitalism-and-markets: Capitalism and markets / سرمایه‌داری و بازار
- [ ] economy/welfare-state: The welfare state / دولت رفاه
- [ ] economy/inequality: Inequality / نابرابری
- [ ] economy/inflation-and-unemployment: Inflation, unemployment and politics / تورم، بیکاری و سیاست
- [ ] economy/globalisation-and-trade: Globalisation and trade / جهانی‌شدن و تجارت
- [ ] economy/sanctions: Sanctions / تحریم‌ها

## world

- [ ] world/international-relations: International relations / روابط بین‌الملل
- [ ] world/diplomacy: Diplomacy / دیپلماسی
- [ ] world/united-nations: The United Nations / سازمان ملل متحد
- [ ] world/war-peace-and-security: War, peace and security / جنگ، صلح و امنیت
- [ ] world/regional-organisations: Regional organisations / سازمان‌های منطقه‌ای
- [ ] world/democratisation-and-revolution: Democratisation, revolution and regime change / دموکراتیزاسیون، انقلاب و تغییر رژیم
- [ ] world/colonialism-and-decolonisation: Colonialism and decolonisation / استعمار و استعمارزدایی

## history

- [ ] history/ancient-political-thought: Ancient political thought / اندیشهٔ سیاسی باستان
- [ ] history/enlightenment-and-revolutions: The Enlightenment and the great revolutions / روشنگری و انقلاب‌های بزرگ
- [ ] history/twentieth-century-politics: Politics in the twentieth century / سیاست در قرن بیستم
- [ ] history/constitutional-movements-in-iran: Constitutional movements in Iran / جنبش‌های مشروطه‌خواهی در ایران
- [ ] history/modern-iran-political-system: Iran's political system today / نظام سیاسی ایران امروز
