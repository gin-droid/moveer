import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";

export const STORE_PRODUCTS = {
  pro: {
    monthly: import.meta.env.VITE_REVENUECAT_PRO_MONTHLY_PRODUCT_ID?.trim() || "",
    annual: import.meta.env.VITE_REVENUECAT_PRO_ANNUAL_PRODUCT_ID?.trim() || "",
  },
  coach: {
    monthly: import.meta.env.VITE_REVENUECAT_COACH_MONTHLY_PRODUCT_ID?.trim() || "",
    annual: import.meta.env.VITE_REVENUECAT_COACH_ANNUAL_PRODUCT_ID?.trim() || "",
  },
};

export const isNativeStoreAvailable = () => Capacitor.isNativePlatform();

export async function configureStorePurchases(appUserID) {
  const platform = Capacitor.getPlatform();
  if (platform !== "ios" && platform !== "android") {
    throw new Error("Gli acquisti in-app sono disponibili solo nelle app iOS e Android.");
  }

  const apiKey = platform === "ios"
    ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY
    : import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) throw new Error(`Configura la chiave pubblica RevenueCat per ${platform}.`);

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
  for (const [planID, periods] of Object.entries(STORE_PRODUCTS)) {
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

export async function purchaseStorePackage(aPackage) {
  return Purchases.purchasePackage({ aPackage });
}

export async function restoreStorePurchases() {
  return Purchases.restorePurchases();
}

export function storeManagementUrl() {
  return Capacitor.getPlatform() === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions?package=com.moveerai.app";
}