const fs = require("fs");
const { PdfConverter, XlsxConverter } = require('./convert.js');
const openAiClient = require('./openai.js')
const { mainModule } = require("process");
require('dotenv').config();

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

async function uploadOpenAiFile(file, client) {
  try {
    return new Promise((resolve, reject) => {
      // Upload the file to OpenAI then create a response
      client.uploadFile(file).then((file_Id) => {
        console.log("File ID:", file_Id);
        resolve(file_Id);
      }).catch((error) => {
        console.error("Error uploading file:", error);
        reject(error);
      });
    });
  }
  catch (error) {
    console.log('Error uploading file to OpenAI:', error);
    throw error; // Rethrow the error to be handled in the calling function
  }
}

async function createOpenAiResponse(obj, file_Id, client) {
  try {
    return new Promise((resolve, reject) => {
      // Create a response using the OpenAI API
      client.createResponse(obj, file_Id).then((response) => {
        console.log("Response from OpenAI:", response);
        resolve(response);
      }).catch((error) => {
        console.error("Error creating response:", error);
        reject(error);
      });
    });
  }
  catch (error) {
    console.log('Error creating OpenAI response:', error);
    throw error; // Rethrow the error to be handled in the calling function
  }
} 

// Main function to execute the conversion, upload and response for OpenAI
async function main() {
  const directoryPath = process.argv[2];
  const outputDirectory = process.argv[3];
  const filename = process.argv[4];
  const file = `${outputDirectory}/${filename}`
  if (!directoryPath || !outputDirectory) {
    console.error("Please provide the input and output directory paths.");
    return;
  }
  await readDirectory(directoryPath, file);
  const client = new openAiClient(process.env.APIKEY);
  const file_Id = await uploadOpenAiFile(file, client);
  const obj = {
    model: 'o3',
    instructions: `Parse the CSV text file containing page numbers, line items, and field names, and 
    insert the correct values for each field name based on the data contained in the line items column, which are separated by page. The output should be in CSV format.
    Workflow:
    1.	Chunk or window the unstructured text. 
    2.	Create Embeddings for both fields/queries and chunks.
    3.	Use sematic search algorithms to extract values based on field names.
    For each field ("Item Name", "Unit/Box", etc.):
    4.	Generate semantic variants and synonyms (e.g., "pieces per box", "pcs in box", "units/box").
    5.	Embed possible field names AND text blob using models (e.g., BERT, Sentence Transformers).
    6.	Search your blob for the area semantically closest to the field using similarity measures (cosine similarity, etc.) between embeddings.
    7.	Extract nearby values as potential candidates for the field.
    Finally: 
    8. Use regex after narrowing search area with embeddings/semantic search, for high precision.` 
  }
  const response = await createOpenAiResponse(obj, file_Id, client);
  console.log('Response from OpenAI', response);
}

// Execute the main function
main()
.then(() => {
  console.log("All files processed successfully.");
})
.catch((error) => {
  console.error("Error in main function:", error);
}); 

