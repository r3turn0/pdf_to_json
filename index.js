const fs = require("fs");
const { PdfConverter, XlsxConverter } = require('./convert.js');
const { mainModule } = require("process");

async function isPdfFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats.isFile() && filePath.endsWith('.pdf'));
      }
    });
  });
}

async function isExcelFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats.isFile() && filePath.endsWith('.xlsx'));
      }
    });
  });  
}

// Check if the file is a PDF or Excel file
async function checkFileType(filePath) {
  try {
    const isPdf = await isPdfFile(filePath);
    const isExcel = await isExcelFile(filePath);
    if (isPdf) {
      return "pdf";
    } else if (isExcel) {
      return "xlsx";
    } else {
      console.log("The file is neither a PDF nor an Excel file.");
    }
  } catch (error) {
    console.error("Error checking file type:", error);
  }
}

// Reads a directory and performs an action based on the file type
async function readDirectory(directoryPath, outputDirectory) {
  try {
    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      const filePath = `${directoryPath}/${file}`;
      const fileType = await checkFileType(filePath);
      if (fileType === "pdf") {
        console.log(`Processing PDF file: ${file}`);
        let converter = new PdfConverter();
        let csv = await converter.convert(`${directoryPath}/${file}`, outputDirectory);
        console.log("Converted to CSV:", csv);
      } else if (fileType === "xlsx") {
        console.log(`Processing Excel file: ${file}`);
        let converter = new XlsxConverter();
        let csv = await converter.convert(`${directoryPath}/${file}`, outputDirectory);
        console.log("Converted to CSV:",csv);
      } else {
        console.log(`Skipping non-PDF/Excel file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
  }
}

// Main function to execute the conversion
async function main() {
  const directoryPath = process.argv[2];
  const outputDirectory = process.argv[3];
  if (!directoryPath || !outputDirectory) {
    console.error("Please provide the input and output directory paths.");
    return;
  }
  await readDirectory(directoryPath, outputDirectory);
}

// Execute the main function
main()
.then(() => {
  console.log("All files processed successfully.");
})
.catch((error) => {
  console.error("Error in main function:", error);
}); 

