// const fs = require("fs");
// const PDFParser = require("pdf2json"); // Import the pdf2json library
// const { mkConfig, generateCsv, asString } = require('export-to-csv');
const PdfConverter = require('./pdfConvert.js');

async function convertPdfToJson(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", (errData) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", function (pdfData) {
      const textData = pdfParser.getRawTextContent(); 
      const pagesData = [];
      if (pdfData.Pages) {
        pdfData.Pages.forEach((page, index) => {
          const pageData = {
            pageNumber: index + 1,
            text: page.Texts.map((text) => {
              return {
                text: decodeURIComponent(text.R[0].T),
              };
            }),
          };
          // concatenate all the text for each object broken down by page, text
          pageData.text = pageData.text.map((text) => text.text).join(" "); // pageData.text is an array of {text: 'string'}
          console.log('Page Data:', pageData.text);
          console.log('----- BREAK -----');
          pagesData.push(pageData);
        });
      }
      const obj = {
        //text: textData,
        pages: pagesData,
      };
      resolve(obj);
    });
    pdfParser.loadPDF(pdfPath);
  });
}

async function halveAndConvertToCsv(pages, csvParts = []) {
    if (!pages || pages.length === 0) {
      return csvParts;
    }
    const half = Math.ceil(pages.length / 2);
    const firstHalf = pages.slice(0, half);
    const secondHalf = pages.slice(half);
    //console.log("Processing first half:", firstHalf);
    //console.log("Processing second half:", secondHalf);
    return new Promise((resolve, reject) => {
      const csvConfig = mkConfig({
        useKeysAsHeaders: true,
        showColumnHeaders: true,
        columnHeaders: ['pages, text'],
        fileExtension: 'csv', 
        useBom: true
      });
      const csvOutput = generateCsv(csvConfig)(firstHalf);
      if(csvOutput) {
        csvParts.push(csvOutput);
        console.log("CSV conversion successful for current half."); 
        halveAndConvertToCsv(secondHalf, csvParts)
          .then(resolve)
          .catch(reject);
      } else {
        console.error("Error converting JSON to CSV for current half.");
        reject(new Error("CSV conversion failed for current half."));
      }
  });
}

async function convertJsonToCsv(jsonData) {
  try {
    return new Promise((resolve, reject) => {
      if (jsonData.pages) {
        halveAndConvertToCsv(jsonData.pages)
          .then((csvParts) => {
            //console.log("CSV parts:", asString(csvParts.join("\n")));
            resolve(asString(csvParts.join("\n"))); // Combine all CSV parts into a single CSV string
          })
          .catch(reject);
      } else {
        reject(new Error("No pages found in JSON data."));
      }
    });
  } catch (error) {
    console.error("Error converting JSON to CSV:", error);
    throw error; // Rethrow the error to be handled in the calling function
  }
}

async function convert(pdfSource, csvDestination) {
  let jsonData, csvData;
  try {
    console.log("Starting conversion from PDF to JSON...");
    jsonData = await convertPdfToJson(pdfSource);
  } catch (error) {
    console.error("Error during conversion convertPdfToJson:", error);
  } finally {
    console.log("Conversion to JSON completed.");
  }
  try {
    console.log("Starting conversion from JSON to CSV...");
    if (jsonData) {
      console.log("jsonData found", jsonData);
      csvData = await convertJsonToCsv(jsonData).catch((error) => {
        console.error("Error in convertJsonToCsv:", error);
        throw error;
      });
      //console.log("Generated CSV data:", csvData); // Log the CSV data
    } else {
      throw new Error("JSON data is undefined. Cannot proceed with CSV conversion.");
    }
  } catch (error) {
    console.error("Error during conversion convertJsonToCSV:", error);
  } finally {
    console.log("Conversion to CSV completed.");
  }
  try {
    if (csvData) {
      fs.writeFileSync(csvDestination, csvData);
      console.log("CSV file created successfully.");
    } else {
      console.error("CSV data is undefined or empty. File not written.");
    }
  } catch (error) {
    console.error("Error writing CSV file:", error);
  } finally {
    console.log("File writing completed.");
  }
}

// convert("./pdf/Z9K DT-AO-MZ 11.4.24.pdf", "./test/output.csv")

async function main() {
  let converter = new PdfConverter();
  //let pdf2json = await converter.convertPdfToJson("./pdf/Z9K DT-AO-MZ 11.4.24.pdf");
  //console.log(pdf2json);
  //let json2csv = await converter.convertJsonToCsv(pdf2json);
  //console.log(json2csv);
  let txt = await converter.convert("./pdf/Z9K DT-AO-MZ 11.4.24.pdf", "./test/output.txt");
  console.log(txt);
} 

main();
