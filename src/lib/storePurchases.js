import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { Purchases } from "@revenuecat/purchases-capacitor";

const APPLE_PRODUCTS = {
  pro: {
    monthly: import.meta.env.VITE_APPLE_PRO_MONTHLY_PRODUCT_ID?.trim() || "",
    annual: import.meta.env.VITE_APPLE_PRO_ANNUAL_PRODUCT_ID?.trim() || "",
  },
  coach: {
    monthly: import.meta.env.VITE_APPLE_COACH_MONTHLY_PRODUCT_ID?.trim() || "",
    annual: import.meta.env.VITE_APPLE_COACH_ANNUAL_PRODUCT_ID?.trim() || "",
  },
};

const GOOGLE_PLAY_PRODUCTS = {
  pro: { monthly: "pro-monthly", annual: "pro-annual" },
  coach: { monthly: "coach-monthly", annual: "coach-annual" },
};

export const isNativeStoreAvailable = () => ["ios", "android"].includes(Capacitor.getPlatform());
export const isAndroidStore = () => Capacitor.getPlatform() === "android";

async function obfuscatedAccountId(userId) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`moveerai:${userId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function configureGooglePlay() {
  const { isBillingSupported } = await NativePurchases.isBillingSupported();
  if (!isBillingSupported) throw new Error("Google Play Billing non è disponibile su questo dispositivo.");

  const productIdentifiers = Object.values(GOOGLE_PLAY_PRODUCTS).flatMap(Object.values);
  const { products } = await NativePurchases.getProducts({
    productIdentifiers,
    productType: PURCHASE_TYPE.SUBS,
  });
  const packages = { pro: {}, coach: {} };

  for (const [planId, periods] of Object.entries(GOOGLE_PLAY_PRODUCTS)) {
    for (const [period, productId] of Object.entries(periods)) {
      const offers = products.filter((product) => product.planIdentifier === productId);
      const product = offers.find((offer) => !offer.offerId) || offers[0];
      packages[planId][period] = product ? { product } : null;
    }
  }
  return packages;
}

async function configureAppleStore(appUserID) {
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
  if (!apiKey) throw new Error("Configura la chiave pubblica RevenueCat per iOS.");

  const { isConfigured } = await Purchases.isConfigured();
  if (!isConfigured) {
    await Purchases.configure({ apiKey, appUserID });
  } else {
    const { appUserID: configuredUserID } = await Purchases.getAppUserID();
    if (configuredUserID !== appUserID) await Purchases.logIn({ appUserID });
  }

  const offerings = await Purchases.getOfferings();
  if (!offerings.current) throw new Error("Nessuna offerta attiva configurata in RevenueCat.");

  const packages = {};
  for (const [planID, periods] of Object.entries(APPLE_PRODUCTS)) {
    packages[planID] = {};
    for (const [period, productID] of Object.entries(periods)) {
      if (!productID) {
        packages[planID][period] = null;
        continue;
      }
      packages[planID][period] = offerings.current.availablePackages.find(({ product }) =>
        product.identifier === productID || product.identifier.startsWith(`${productID}:`)
      ) || null;
    }
  }
  return packages;
}

export async function configureStorePurchases(appUserID) {
  const platform = Capacitor.getPlatform();
  if (platform === "android") return configureGooglePlay();
  if (platform === "ios") return configureAppleStore(appUserID);
  throw new Error("Gli acquisti in-app sono disponibili solo nelle app iOS e Android.");
}

export async function purchaseStorePackage(aPackage, appUserID) {
  if (isAndroidStore()) {
    const product = aPackage.product;
    return NativePurchases.purchaseProduct({
      productIdentifier: product.planIdentifier,
      productType: PURCHASE_TYPE.SUBS,
      planIdentifier: product.identifier,
      ...(product.offerToken ? { offerToken: product.offerToken } : {}),
      appAccountToken: await obfuscatedAccountId(appUserID),
    });
  }
  return Purchases.purchasePackage({ aPackage });
}

export async function getStorePurchases() {
  if (isAndroidStore()) {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
    return purchases;
  }
  return [];
}

export async function restoreStorePurchases() {
  if (isAndroidStore()) {
    await NativePurchases.restorePurchases();
    return getStorePurchases();
  }
  return Purchases.restorePurchases();
}

export function storeManagementUrl() {
  return Capacitor.getPlatform() === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions?package=com.moveerai.app";
}
