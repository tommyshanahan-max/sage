/* WHICH BANK FIELDS A PAYMENT TO EACH TERRITORY NEEDS
 * ===========================================================================
 *
 * TAX IS NOT OUR BUSINESS, AND THAT IS A DECISION, NOT AN OMISSION.
 *
 * This file briefly collected an ABN and a GST registration from Australians,
 * a VAT number from Finns, an EIN from Americans. All of it came out, because
 * the premise under it was wrong: the reasoning was "without an ABN the payer
 * must withhold 47% and send it to the ATO", which is true — of an AUSTRALIAN
 * payer. **We are a Chinese company.** A WFOE wiring money to an Australian
 * supplier has no ATO withholding obligation, so there was never a reason for
 * us to hold their ABN, and none at all for the VAT and EIN that followed it
 * by analogy.
 *
 * What a supplier owes their own revenue office is between them and it. We
 * need to get money to their bank. That is the whole of what is here.
 *
 * (The other half of a deal is different and stays: the payer's 开票信息 in
 * lib/fapiao.js. That is not their tax affairs, it is the invoice WE issue
 * THEM, in the country we are registered in.)
 *
 * SO WHY A TABLE AT ALL. Because how you reach a bank genuinely differs by
 * country and getting it wrong means the money does not arrive: Australia
 * uses a BSB, the United States a routing number, Europe an IBAN, and the
 * rest of the world needs a SWIFT/BIC before anything can be sent at all.
 * That is about delivering money, which is our business entirely.
 *
 * BUILT TO LEAVE, and it lives in public/ rather than lib/ so the screen and
 * the server read the same table — the same arrangement public/off.js has.
 */

export const TERRITORIES = {
  AU: { name: "Australia", bank: ["accountName", "bsb", "accountNumber"] },
  CN: { name: "Mainland China", bank: ["accountName", "bankName", "accountNumber"] },
  /* Hong Kong's own clearing uses a bank code and account, but anything
     arriving from outside comes by wire, so the SWIFT is not optional. */
  HK: { name: "Hong Kong", bank: ["accountName", "bankName", "accountNumber", "swift"] },
  US: { name: "United States", bank: ["accountName", "bankName", "routing", "accountNumber"] },
  FI: { name: "Finland", bank: ["accountName", "bankName", "iban", "swift"] },
  /* THE BRANCH THAT ACTUALLY WIRES MONEY, and the longest for a reason. The
     SWIFT is how the money finds the bank; the address is why a correspondent
     bank lets it through rather than holding it for screening. Both were
     missing once and it cost days. */
  OTHER: { name: "Somewhere else", bank: ["accountName", "bankName", "swift", "iban", "country", "address"] },
};

export const territoryOf = (region) => TERRITORIES[region] || TERRITORIES.OTHER;
export const bankFields = (region) => territoryOf(region).bank.slice();
