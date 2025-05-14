
const fs = require("fs");
const PDFParser = require("pdf2json"); // Import the pdf2json library
const { mkConfig, generateCsv, asString } = require('export-to-csv');

class PdfConverter {
    constructor() {
        this.pdfParser = new PDFParser();
    }

    convertPdfToJson(pdfPath) {
        return new Promise((resolve, reject) => {
        const pdfParser = this.pdfParser;
        pdfParser.on("pdfParser_dataError", (errData) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", function (pdfData) {
        //const textData = pdfParser.getRawTextContent(); 
        const pagesData = [];
        if (pdfData.Pages) {
            pdfData.Pages.forEach((page, index) => {
            const pageData = {
                pageNumber: index + 1,
                data: page.Texts.map((text) => {
                return {
                    text: decodeURIComponent(text.R[0].T),
                };
                }),
            };
            // concatenate all the text for each object broken down by page, text
            pageData.data = pageData.data.map((d) => d.text).join(" "); // pageData.data is an array of {text: 'string'}
            console.log('Page Data:', pageData.data);
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

    // Recursively halves the JSON data in an array and converts it to CSV
    halveAndConvertToCsv(pages, csvParts) {
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
            columnHeaders: ['pages, text', 'Item Name',	'Vendor Item Code',	
                'Sales Description', 'Unit of Measure',	'Unit/Box', 'Item Color', 'Item Size',	
                'PCs in a Box',	'SF by PC/SHEET', 'SF By Box',	'Cost',	'Group'
            ],
            fileExtension: 'csv', 
            useBom: true
        });
        const csvOutput = generateCsv(csvConfig)(firstHalf);
        if(csvOutput) {
            csvParts.push(csvOutput);
            console.log("CSV conversion successful for current half."); 
            this.halveAndConvertToCsv(secondHalf, csvParts)
            .then(resolve)
            .catch(reject);
        } else {
            console.error("Error converting JSON to CSV for current half.");
            reject(new Error("CSV conversion failed for current half."));
        }
    });
    }

    // Converts JSON to CSV
    convertJsonToCsv(jsonData) {
    try {
        return new Promise((resolve, reject) => {
        if (jsonData.pages) {
            halveAndConvertToCsv(jsonData.pages, [])
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

    // This will call the convertPdfToJson function and then the convertJsonToCsv function and returns a promise
    convert(pdfSource, csvDestination) {
    try{
        return new Promise((resolve, reject) => {
        this.convertPdfToJson(pdfSource)
            .then(jsonData => {
                return this.convertJsonToCsv(jsonData);
            })
            .then(csvData => {
                let txt = '';
                const csvHeader = csvData.split("pageNumber,text")[0];
                const data = csvData.split("pageNumber,text")[1];
                const dataArray = data.split("\n").filter(line => line.trim() !== ""); // Filter out empty lines
                txt = csvHeader + '\n';;
                for(let i = 0; i < dataArray.length; i++) {
                    let a = dataArray[i].split(",")[0]; // number
                    let b = dataArray[i].split(",")[1]; // string
                    let lineHeader = "'Item Name, Vendor Item Code, Sales Description, Unit of Measure, Unit/Box, Item Color, Item Size, PCs in a Box, SF by PC/SHEET, SF By Box, Cost, Group'";
                    let line = a + ',' + lineHeader + ',' + b;
                    txt += line + '\n';
                }
                fs.writeFileSync(csvDestination, txt, 'utf8');
                console.log("CSV file created successfully.");
                resolve("Conversion completed");
            })
            .catch(error => {
                console.error("Error during conversion:", error);
                reject(error);
            });
        });
    }
    catch (error) {
        console.error("Error during conversion:", error);
        throw error; // Rethrow the error to be handled in the calling function
    }
    }
} // End of class

// Export class
module.exports= PdfConverter;