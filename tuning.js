const path = require('path');
const openAiClient = require('./openai.js')
const fs = require("fs");
const { CSVConverter } = require('./convert.js');
require('dotenv').config();

async function concatCSVs() {
    let tuningFile = '';
    const files = fs.readdirSync('./tuning');
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    csvFiles.forEach(file => {
        tuningFile += fs.readFileSync(path.join('./tuning', file), 'utf8') + '\n';
    });
    const csvFilePath = './tuning/tuning.csv';
    fs.writeFileSync(csvFilePath, tuningFile, 'utf8');
    console.log("CSV file created successfully:", csvFilePath);
    const csv = new CSVConverter();
    const json = await csv.convertCsvToJson(csvFilePath);
    console.log("JSON data created:", json);
    return json;
}

// const content = `Find the following values for the fields provided in the files found in the Elite vector store: 
// Item Name, Vendor Item Code, Packaging Information Unit of Measure, Unit/Box, Item Color, Item Size, PCs in a Box, SF by PC/SHEET, SF By Box, Cost, Group, Finish.
// Here are some sample values that I am looking for: ` + tuningFile;

// const instructions = `You are a data analyst able to read, analyze and extract data from PDF, Excel and CSV files.
// Your task is to analyze the data and infer values based on the fields given. Respond only with a JSON object for fine tuning the model, without any explanation, summary, or commentary. 
// Do not add any introductory or concluding text.`

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

async function run(content, instructions) {
    try {
        const threadResponse = await createAIThread(content);
        // runThreadResponse return a json object with thread_id
        const runThreadResponse = await runAIThread(threadResponse.id, instructions);
        console.log("Run thread response:", runThreadResponse);
        if(runThreadResponse.status === 'completed') {
            // Create a message in the thread
            const message = await client.createMessage(runThreadResponse.thread_id);
            if(message) {
                console.log("Message:", message);
                console.log("Message content:", message.content[0].text);
                const msg = await client.getMessage(message, runThreadResponse.thread_id);
                if(msg) {
                    console.log("Message retrieved successfully:", msg.content[0].text);
                    const tfile = fs.writeFileSync('./tuning/tuningFile.json', JSON.stringify(msg, null, 2));
                    console.log("Tuning file created successfully:", tfile);
                    const fileId = await client.uploadTuningFile(tfile);
                    const jsonFile = await client.retrieveFile(fileId.id); 
                    console.log("File retrieved successfully:", jsonFile);
                    const fineTuneResponse = await client.createFineTuneJob(jsonFile);
                    console.log('Fine-tuning job created successfully:', fineTuneResponse);
                }
            }
        }
    }
    catch (error) {
        console.error("Error in run function:", error);
    }
}

// run(content, instructions).then(() => {
//     console.log("Fine-tuning process completed successfully.");
// }).catch((error) => {
//     console.error("Error during fine-tuning process:", error);
// });

async function main() {
    const json = await concatCSVs();
    const jsonlData = json.map(item => JSON.stringify(item)).join('\n');
    fs.writeFileSync('./tuning/tuning.jsonl', jsonlData, 'utf8');
    const fileId = await client.uploadTuningFile('./tuning/tuning.jsonl');
    const jsonFile = await client.retrieveFile(fileId); 
    console.log("File retrieved successfully:", jsonFile);
    const fineTuneResponse = await client.createFineTuneJob(jsonFile.id);
    console.log('Fine-tuning job created successfully:', fineTuneResponse);
}

main();