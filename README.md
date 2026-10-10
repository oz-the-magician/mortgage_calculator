# Mortgage Calculator

**Sell one flat, buy another: how big a mortgage you need and how much of your income it will take.** Most mortgage calculators start from a loan amount. This one starts from the deal itself. You enter the sale of your current flat, what's left on its mortgage, agent fees, maternity capital, savings and any extra loans. It works out the gap that a new mortgage has to cover, then shows the monthly payment and the share of your income it takes.

> 🇷🇺 Калькулятор финансовой нагрузки при обмене жилья: продаём квартиру А → покупаем Б → сколько ипотеки нужно, какой будет платёж и какая доля дохода на него уйдёт.

**[Open the calculator →](https://oz-the-magician.github.io/mortgage-calculator/)**

![Calculator screenshot](docs/screenshot.png)

## What it does

| Block | What you get |
|---|---|
| **Deal balance** | Line-by-line flow of money: sale proceeds, mortgage payoff, fees, maternity capital, savings and loans add up to the cash on hand, which is compared with the price of the new flat. Shows either the mortgage needed or the cash left over |
| **Down payment** | Share of the price covered by your own money, with a warning below 20%. Extra loans are excluded, since they are debt too |
| **Mortgage** | Rate, term (1–30 years), annuity or differentiated payments. For differentiated payments it shows the first and last payment |
| **Extra loans** | Any number of consumer loans to close the gap, each with its own rate, term, payment and annuity schedule |
| **Load summary** | Total monthly payment, total overpayment and total paid, plus the payment as a share of income: green up to 35%, amber up to 50%, red above that |
| **Amortization** | Year-by-year schedule for the mortgage (5 years / 10 years / full term) and for each loan |
| **PDF export** | Saves the whole calculation as an A4 PDF |

Everything recalculates as you type. Amounts are in roubles, and the interface is in Russian.

## Run locally

It's a single static file with no build step and no dependencies to install. Just open `index.html` in a browser.

## Stack

Vanilla HTML, CSS and JavaScript. [jsPDF](https://github.com/parallax/jsPDF) and [html2canvas](https://github.com/niklasvh/html2canvas) handle the PDF export. Fonts are Unbounded, IBM Plex Sans and Azeret Mono from Google Fonts.

## Disclaimer

The results are estimates. Banks apply their own rules for down payments, insurance and income checks, so treat this as a planning tool, not an offer.

## License

[MIT](LICENSE)
