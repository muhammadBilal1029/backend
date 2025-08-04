const cheerio = require("cheerio");
const puppeteerExtra = require("puppeteer-extra");
const stealthPlugin = require("puppeteer-extra-plugin-stealth");
const Lead = require("../models/Lead");
const { scrapeData } = require("./websiteScrapping");

const fs = require("fs");
const os = require("os");
const path = require("path");

// Helper function to get browser path
// function getLocalBrowserPath() {
//   const paths = {
//     win32: [
//       "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
//       "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
//       "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
//       "C:\\Program Files\\Opera\\launcher.exe",
//     ],
//     darwin: [
//       // macOS paths
//       "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
//       "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
//       "/Applications/Firefox.app/Contents/MacOS/firefox",
//       "/Applications/Opera.app/Contents/MacOS/Opera",
//     ],
//     linux: [
//       // Linux paths
//       "/usr/bin/google-chrome",
//       "/usr/bin/microsoft-edge",
//       "/usr/bin/firefox",
//       "/usr/bin/opera",
//     ],
//   };

//   const platform = process.platform;
//   const browserPaths = paths[platform] || [];

//   // Return the first existing browser path
//   for (const browserPath of browserPaths) {
//     if (fs.existsSync(browserPath)) {
//       return browserPath;
//     }
//   }

//   throw new Error("No supported browser found on this system.");
// }

async function searchGoogleMaps(project) {
  try {
    const start = Date.now();
    const { city, businessCategory, vendorId } = project;

    const browser = await puppeteerExtra.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    console.log("Browser launched");

    const page = await browser.newPage();
    const query = `${businessCategory} ${city}`;
    const searchUrl = `https://www.google.com/maps/search/${query.split(" ").join("+")}`;
    console.log(`Navigating: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Scroll to load results
    await page.evaluate(async () => {
      const wrapper = document.querySelector('div[role="feed"]');
      if (!wrapper) return;
      let totalHeight = 0;
      const distance = 1000;
      const scrollDelay = 2000;

      for (let i = 0; i < 20; i++) {
        wrapper.scrollBy(0, distance);
        totalHeight += distance;
        await new Promise((resolve) => setTimeout(resolve, scrollDelay));
      }
    });

    const html = await page.content();
    await browser.close();
    console.log("Browser closed");

    const $ = cheerio.load(html);
    const parents = [];
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("/maps/place/")) {
        parents.push($(el).parent());
      }
    });

    console.log("Number of businesses found:", parents.length);

    const businesses = parents.map((parent) => {
      const url = parent.find("a").attr("href");
      const website = parent.find('a[data-value="Website"]').attr("href");
      const storeName = parent.find("div.fontHeadlineSmall").text();
      const ratingText = parent.find("span.fontBodyMedium > span").attr("aria-label");

      const bodyDiv = parent.find("div.fontBodyMedium").first();
      const children = bodyDiv.children();
      const firstOfLast = children.last().children().first();
      const lastOfLast = children.last().children().last();
      const imageUrl = parent.find("img").attr("src");

      return {
        placeId: url?.includes("ChI") ? `ChI${url.split("ChI")[1]?.split("?")[0]}` : null,
        address: firstOfLast?.text() || "",
        category: firstOfLast?.text()?.split("·")[0]?.trim() || "",
        projectCategory: businessCategory,
        phone: lastOfLast?.text()?.split("·")[1]?.trim() || "",
        googleUrl: url || "",
        bizWebsite: website || "",
        storeName: storeName || "",
        ratingText: ratingText || "",
        imageUrl: imageUrl || "",
        vendorId,
        stars: ratingText?.includes("stars") ? Number(ratingText.split("stars")[0].trim()) : null,
        numberOfReviews: (() => {
          const reviewsText = ratingText?.split("stars")[1]?.replace("Reviews", "")?.trim();
          return reviewsText && !isNaN(Number(reviewsText)) ? Number(reviewsText) : 0;
        })(),
      };
    });

    // Scrape additional data from websites
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const concurrencyLimit = 3;
    const batchResults = [];

    for (let i = 0; i < businesses.length; i += concurrencyLimit) {
      const batch = businesses.slice(i, i + concurrencyLimit);
      const results = await Promise.all(
        batch.map(async (data) => {
          try {
            if (data.bizWebsite) {
              const websiteDetails = await scrapeData(data.bizWebsite);
              return {
                ...data,
                websiteDetails: {
                  about: websiteDetails.about || "",
                  logoUrl: websiteDetails.logoUrl || "",
                  email: websiteDetails.email || "",
                  socialLinks: {
                    youtube: websiteDetails.socialLinks?.youtube || "",
                    instagram: websiteDetails.socialLinks?.instagram || "",
                    facebook: websiteDetails.socialLinks?.facebook || "",
                    linkedin: websiteDetails.socialLinks?.linkedin || "",
                  },
                  images: websiteDetails.images || [],
                },
              };
            }
          } catch (err) {
            console.error("Error scraping website:", data.bizWebsite, err.message);
          }
          return data;
        })
      );
      batchResults.push(...results);
      await delay(3000); // optional throttle
    }

    // Save leads
    console.log("Saving leads...");
    for (const [i, business] of batchResults.entries()) {
      const lead = new Lead({
        ...business,
        about: business.websiteDetails?.about || "",
        logoUrl: business.websiteDetails?.logoUrl || "",
        email: business.websiteDetails?.email || "",
        socialLinks: business.websiteDetails?.socialLinks || {},
        images: business.websiteDetails?.images || [],
      });

      try {
        await lead.save();
        console.log(`[${i + 1}/${batchResults.length}] Saved lead: ${lead.storeName}`);
      } catch (err) {
        console.error(`Error saving lead (${lead.storeName}):`, err.message);
      }
    }

    console.log("Processed sample:", batchResults.slice(0, 5));
    console.log(`Time taken: ${Math.floor((Date.now() - start) / 1000)}s`);
    return batchResults;
  } catch (error) {
    console.error("Error in searchGoogleMaps:", error.message);
    throw error;
  }
}

module.exports = { searchGoogleMaps };
