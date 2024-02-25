const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const csv = require('csv-parser');

//merge both people and company data array
function mergeArrays(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        throw new Error("Arrays must have the same length");
    }
    
    const mergedArray = [];
    
    for (let i = 0; i < arr1.length; i++) {
        const mergedObject = { ...arr1[i], ...arr2[i] };
        mergedArray.push(mergedObject);
    }
    
    return mergedArray;
}


async function scrapeLinkedIn(companyList) {
  const comanyLinkedinUrl = []
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  const isLoginPage = await page.$('#username') && await page.$('#password');

  if (isLoginPage) {
    await page.type('#username', 'guptahemant65@gmail.com');
    await page.type('#password', 'HMG@5520');
    await page.click('.login__form_action_container button');
  
    await page.waitForNavigation();
  }

  const csvWriter = createObjectCsvWriter({
    path: 'results.csv',
    header: [
      { id: 'company', title: 'companyName' },
      { id: 'linkedin_url', title: 'linkedinPageurl' },
      { id: 'people_name', title: 'PeopleName' },
      { id: 'role', title: 'Role' },
      { id: 'website', title: 'Website' },
      { id: 'phone', title: 'Phone' }
    ],
  });

  const companyData = [];
  for (const company of companyList) {
  await page.goto(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`, { waitUntil: 'domcontentloaded' });
  const currentUrl = page.url();
  console.log(`URL after searching for ${company}:`, currentUrl);

  const searchResultHTML = await page.content();
  const $ = cheerio.load(searchResultHTML);

  const results = $('.scaffold-layout__main');

  if (results.length > 0) {
    results.each((index, element) => {
      const companyName = $(element).find('.entity-result__title-text').text().trim();
      const company = companyName.replace(/\s+/g, ' ').trim();
      const companyUrl = $(element).find('.app-aware-link').attr('href');
      const companyUrlFound = companyUrl ? companyUrl : "None";
      comanyLinkedinUrl.push(companyUrlFound);
      // Create the object and push into node 
      const companyObject = { company: company, linkedin_url: companyUrlFound };
      companyData.push(companyObject);
    });
  }
}

// Scraping people data
const peopleDetail = []
for (const people of companyList) {
  if(people == "None"){
    const personObject = { people_name: "None", role: "None" };
    peopleDetail.push(personObject);
    continue
  }
  await page.goto(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(people + " Top Management")}`, { waitUntil: 'domcontentloaded' });
  const currentUrl = page.url();
  console.log(`URL after searching for ${people}:`, currentUrl);
  const searchResultHTML = await page.content();
  const $ = cheerio.load(searchResultHTML);
  const results = $('.reusable-search__result-container').eq(1);
  const n = results.find('span[dir="ltr"]').text().trim();
  let name = n.split('•')[0].trim();
  name = name.split("View")[0].trim();
  const role = results.find('.entity-result__primary-subtitle').text().trim();
  const personObject = { people_name: name, role: role };
  peopleDetail.push(personObject);
}

const companyDetailsAbout = []
for (const pageUrl of comanyLinkedinUrl) {
   if(pageUrl == "None"){
    const aboutObject = { website: "NA", phone: "NA" };
    companyDetailsAbout.push(aboutObject);
    continue
  }
  await page.goto(`${pageUrl}about/`, { waitUntil: 'domcontentloaded' });
  const currentUrl = page.url();
  console.log(`about page after searching for ${pageUrl}about/:`);
  const searchResultHTML = await page.content();
  const $ = cheerio.load(searchResultHTML);
  const results = $('.ember-view').eq(29);
  const website = results.find('.link-without-visited-state').text().trim();
  const phone  = results.find('.link-without-visited-state .ember-view').eq(1).attr('href');
  const aboutObject = { website: website ? website : "NA", phone: phone ? phone : "NA" };
  companyDetailsAbout.push(aboutObject);
}

  let data = mergeArrays(companyData, peopleDetail)
  data = mergeArrays(data, companyDetailsAbout)
  console.log(data);
  await csvWriter.writeRecords(data);
  console.log('CSV file has been written successfully.');

  await browser.close();
}

const companyList = [];
fs.createReadStream('company.csv')
  .pipe(csv())
  .on('data', (row) => {
    const companyNames = Object.values(row);
    companyNames.forEach((name) => {
      companyList.push(name);
    });
  })
  .on('end', () => {
    console.log('Company list has been read from CSV:', companyList);
    if (companyList.length > 0) {
      scrapeLinkedIn(companyList)
        .then(() => console.log('Scraping completed'))
        .catch((error) => console.error('Error:', error));
    } else {
      console.error('No valid company names found in the CSV file.');
    }
  });