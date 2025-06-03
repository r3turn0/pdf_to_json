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
        resolve({file_id: file_Id, file: file});
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

async function createOpenAiResponse(client, obj, file_obj, pdf) {
  try {
    return new Promise((resolve, reject) => {
      // Create a response using the OpenAI API
      client.createResponse(obj, file_obj, pdf).then((response) => {
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
  const files = fs.readdirSync(directoryPath);
  const pdf = files[0];
  const outputDirectory = process.argv[3];
  // The text or csv file to be saved in output directory
  const filename = process.argv[4];
  const file = `${outputDirectory}/${filename}`
  if (!directoryPath || !outputDirectory) {
    console.error("Please provide the input and output directory paths.");
    return;
  }
  // input directory and output file
  await readDirectory(directoryPath, file);
  const client = new openAiClient(process.env.APIKEY);
  let file_obj = {file: null, fileID: null};
  file_obj = await uploadOpenAiFile('pdf/' + pdf, client);
  const obj = {
    model: process.env.MODEL,
    instructions: `Parse the input file containing page numbers, line items, and field names, and insert the correct values for each field name based on the data contained in the line items column, which are separated by page. The output should be in CSV format for ALL records in ALL pages.
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
  const response = await createOpenAiResponse(client, obj, file_obj, pdf);
  console.log('Response from OpenAI:', response);
  if(response.output_text) {
    const output = response.output_text;
    console.log("Output from OpenAI:", output);
    const outputFile = `${outputDirectory}/${process.argv[5]}`;
    fs.writeFileSync(outputFile, output);
    console.log("Output written to:", outputFile); 
  }
}

// Execute the main function
// Example usage: node index.js <input_directory> <output_directory> <output_file> <output_csv>
// A retry function that calls the main process up to 3 times

async function retry(count, completed) {
  try {
    if (count > 0 && completed !== true) {
      await program(completed);
      return await retry(count - 1, completed);
    } else if (count <= 0) {
      console.log('Retry limit reached. Exiting.');
    }
  } catch (e) {
    console.log('Error on retry/recursive function:', e);
  }
}

async function program(completed) {
  try {
    main()
    .then(() => {
      console.log("All files processed successfully.");
      completed = true;
    })
    .catch((error) => {
      console.error("Error in main function:", error);
    }); 
  }
  catch(e) {
    console.log('Error on main program:', e);
    await retry(3, false);
  }
}

await program(false);
