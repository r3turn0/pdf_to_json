const path = require('path');
const openAiClient = require('./openai.js')
const fs = require("fs");
const { CSVConverter } = require('./convert.js');
const { stringify } = require('querystring');
require('dotenv').config();

async function concatCSVs() {
    let tuningFile = '';
    const files = fs.readdirSync('./test');
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    if (csvFiles.length === 0) {
        throw new Error("No CSV files found in the './tuning' directory.");
    }
    let isFirstFile = true;
    csvFiles.forEach(file => {
        const fileContent = fs.readFileSync(path.join('./test', file), 'utf8');
        const lines = fileContent.split('\n');
        // Helper to filter out empty, '...', and lines with only commas
        const isValidLine = line => {
            const trimmed = line.trim();
            if (trimmed === '' || trimmed === '...') return false;
            // Remove all commas and spaces, if nothing left, it's only commas
            if (trimmed.replace(/[, ]/g, '') === '') return false;
            return true;
        };
        if (isFirstFile) {
            const cleanedLines = lines.filter(isValidLine);
            tuningFile += cleanedLines.join('\n') + '\n';
            isFirstFile = false;
        } else {
            const dataLines = lines.slice(1).filter(isValidLine);
            tuningFile += dataLines.join('\n') + '\n';
        }
    });
    console.log("Concatenated CSV files successfully.", tuningFile);
    const csvFilePath = './tuning/tuning.csv';
    fs.writeFileSync(csvFilePath, tuningFile, 'utf8');
    console.log("CSV file created successfully:", csvFilePath);
    const csv = new CSVConverter();
    const json = await csv.convertCsvToJson(csvFilePath);
    console.log("JSON data created:", json);
    return json;
}

const content = `Find the following values for the fields provided in the files found in the Elite vector store. The fields are: 
Item Name, Vendor Item Code, Packaging Information Unit of Measure, Unit/Box, Item Color, Item Size, PCs in a Box, SF by PC/SHEET, SF By Box, Cost, Group, Finish.\n
For the Item Name concatenate Item Name, Item Size and Item Color together.\n`
+ process.env.EXAMPLES;

const instructions = `You are a data analyst able to read, analyze and extract data from PDF, Excel and CSV files.
Your task is to analyze the data and infer values based on the fields given. Respond only with a JSON object for fine tuning the model, without any explanation, summary, or commentary. 
Do not add any introductory or concluding text.`

const client = new openAiClient(process.env.APIKEY);

async function createAIThread(content) {
    try {
        return new Promise((resolve, reject) => {
            client.createThread(content).then((response) => {
                console.log("Thread created successfully:", response);
                resolve(response);
            }).catch((error) => {
                console.error("Error creating thread in createAIThread:", error);
                reject(error);
            });
        });
    }
    catch (error) {
        console.error("Error in createAIThread:", error);
    }
}

async function runAIThread(threadId, instructions) {
    try {
        return new Promise((resolve, reject) => {
            const aid = client.assistant_id;
            client.runThread(threadId, aid, instructions).then((response) => {
                console.log("Thread run successfully:", response);
                resolve(response);
            }).catch((error) => {
                console.error("Error running thread in runAIThread:", error);
                reject(error);
            });
        });
    }
    catch(error) {
        console.error("Error in runAIThread:", error);
    }
}

async function main() {
    const json = await concatCSVs();
    fs.writeFileSync('./tuning/tuning.json', JSON.stringify(json), 'utf8');
    let jsonl = json.map(function(item){
        const o = {
            messages: [
                {
                    role: 'user',
                    content: instructions
                },
                {
                    role: 'assistant',
                    content: JSON.stringify(item, null, 2)
                    .replaceAll('Sales Description'.toLowerCase(), 'Packaging Information')
                    .replaceAll('SF'.toLowerCase(), 'Square Foot')
                    .replaceAll('SHT'.toLowerCase(), 'Sheet')
                    .replaceAll('EA'.toLowerCase(), 'Each')
                    .replaceAll('BX'.toLowerCase(), 'Box')
                    .replaceAll('PC'.toLowerCase(), 'Piece')
                },
            ]
        }
        return JSON.stringify(o);
    }).join('\n');
    fs.writeFileSync('./tuning/tuning.jsonl', jsonl, 'utf8');
    const fileId = await client.uploadTuningFile('./tuning/tuning.jsonl');
    const fileId2 = await client.uploadTuningFile('./tuning/tuning.json');
    const jsonFile = await client.retrieveFile(fileId); 
    const jsonFile2 = await client.retrieveFile(fileId2);
    console.log("File retrieved successfully:", jsonFile);
    console.log("File2 retrieved successfully:", jsonFile2);
    const fineTuneResponse = await client.createFineTuneJob(jsonFile.id);
    console.log('Fine-tuning job created successfully:', fineTuneResponse);
    return jsonFile2;
}

async function run(content, instructions) {
    try {
         const threadResponse = await createAIThread(content);
         // runThreadResponse return a json object with thread_id
         const runThreadResponse = await runAIThread(threadResponse.id, instructions);
         console.log("Run thread response:", runThreadResponse);
         if(runThreadResponse.status === 'completed') {
            const jsonFile = await main();
            console.log("JSON file created successfully:", jsonFile);
             // Create a message in the thread
            const message = await client.createMessage(runThreadResponse.thread_id, jsonFile.id);
            if(message) {
                console.log("Message:", message);
                console.log("Message content:", message.content[0].text);
                const msg = await client.getMessage(message, runThreadResponse.thread_id);
                if(msg) {
                     console.log("Message retrieved successfully:", msg.content[0].text);
                }
             }
         }
    }
    catch (error) {
        console.error("Error in run function:", error);
    }
}

//main();

run(content, instructions).then(() => {
    console.log("Fine-tuning process completed successfully.");
}).catch((error) => {
    console.error("Error during fine-tuning process:", error);
});