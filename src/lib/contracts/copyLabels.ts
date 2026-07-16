// Which copy of a printed document this is. Always Tajik, never the UI
// locale: the contract and the receipt are official Tajik documents, so the
// language of the paper doesn't change just because a manager happens to
// have the interface switched to Russian. (Before this, the contract pulled
// these from the dictionary and printed Russian labels onto a Tajik
// document, while the receipt hardcoded Tajik -- two behaviours for the
// same thing.)
export const COPY_FOR_CLIENT = "Нусха барои мизоҷ";
export const COPY_FOR_COMPANY = "Нусха барои ширкат";
