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
 * SO WHY A TABLE AT ALL. Because the last step differs by country and
 * getting it wrong means the money does not arrive: Australia uses a BSB,
 * the United States a routing number, Europe an IBAN. The SWIFT is what they
 * all share, because they are all wires out of China. That is about
 * delivering money, which is our business entirely.
 *
 * BUILT TO LEAVE, and it lives in public/ rather than lib/ so the screen and
 * the server read the same table — the same arrangement public/off.js has.
 */

/* THE PAYER IS ALWAYS THE WFOE, IN CHINA. So every payout except a Chinese
 * one is a CROSS-BORDER WIRE, and a cross-border wire needs a SWIFT/BIC
 * whatever country it lands in.
 *
 * This table was first written as if each payment were domestic to its own
 * country — Australia got a BSB and an account number, the United States a
 * routing number, and neither was asked for a SWIFT. That is right for an
 * Australian paying an Australian. It is wrong for us, and it was reported
 * the moment somebody tried to add an Australian account: no SWIFT field
 * anywhere, on a payment that cannot be sent without one.
 *
 * So the local number stays — a BSB or a routing number is what gets the
 * money the last step, to the branch, once the SWIFT has got it to the bank —
 * and the SWIFT sits above it. Both, not either.
 *
 * AND THE ADDRESS, for the same reason it was always on the international
 * branch: correspondent banks screen payments, and a beneficiary with no
 * address is the commonest reason one is held.
 *
 * Mainland China is the exception and the only one: that is the WFOE paying
 * inside its own country, domestic CNY, no border and no correspondent.
 */
export const TERRITORIES = {
  CN: { name: "Mainland China", bank: ["accountName", "bankName", "accountNumber"] },
  AU: { name: "Australia", bank: ["accountName", "bankName", "swift", "bsb", "accountNumber", "address"] },
  US: { name: "United States", bank: ["accountName", "bankName", "swift", "routing", "accountNumber", "address"] },
  HK: { name: "Hong Kong", bank: ["accountName", "bankName", "swift", "accountNumber", "address"] },
  FI: { name: "Finland", bank: ["accountName", "bankName", "swift", "iban", "address"] },
  /* The one that names its own country, because "Somewhere else" does not. */
  OTHER: { name: "Somewhere else", bank: ["accountName", "bankName", "swift", "iban", "country", "address"] },
};

export const territoryOf = (region) => TERRITORIES[region] || TERRITORIES.OTHER;
export const bankFields = (region) => territoryOf(region).bank.slice();
