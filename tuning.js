const path = require('path');
const openAiClient = require('./openai.js')
const fs = require("fs");
require('dotenv').config();

const files = fs.readdirSync(path.join(__dirname, 'tuning'));
let tuningFile;
files.forEach(file => {
    fs.readFileSync(file, 'utf8', (err, data) => {
        if (err) { 
            tuningFile += data + '\n';
        }
    });
});
const content = `Find the following values for the fields provided in the files found in the Elite vector store: 
Item Name, Vendor Item Code, Packaging Information Unit of Measure, Unit/Box, Item Color, Item Size, PCs in a Box, SF by PC/SHEET, SF By Box, Cost, Group, Finish.
Here are some sample values that I am looking for: ` + tuningFile;

const instructions = `You are a data analyst able to read, analyze and extract data from PDF, Excel and CSV files.
Your task is to analyze the data and infer values based on the fields given. Respond only with a JSON object for fine tuning the model, without any explanation, summary, or commentary. 
Do not add any introductory or concluding text.`

const client = new openAiClient();

async function functionCreateThread(content) {
    try {
        return new Promise((resolve, reject) => {
            if (!thread || !thread.name || !thread.content) {
                console.error("Invalid thread object:", thread);
                reject(new Error("Invalid thread object"));
                return;
            }
            client.createThread(content).then((response) => {
                console.log("Thread created successfully:", response);
                resolve(thread);
            }).catch((error) => {
                console.error("Error creating thread:", error);
            });
        });
    }
    catch (error) {
        console.error("Error in functionCreateThread:", error);
    }
}

async function runThread(threadId, instructions) {
    try {
        return new Promise((resolve, reject) => {
            const aid = client.assistant_id;
            client.runThread(threadId, aid, instructions).then((response) => {
                console.log("Thread run successfully:", response);
                resolve(response);
            }).catch((error) => {
                console.error("Error running thread:", error);
                reject(error);
            });
        });
    }
    catch(error) {
        console.error("Error in runThread:", error);
    }
}

async function run(content, instructions) {
    try {
        const threadResponse = await functionCreateThread(content);
        // runThreadResponse return a json object
        const runThreadResponse = await runThread(threadResponse.id, instructions);
        const tfile = fs.writeFileSync('./tuning/tuningFile.json', JSON.stringify(runThreadResponse, null, 2));
        const fileId = await client.uploadTuningFile(tfile);
        const jsonFile = await client.retrieveFile(fileId); 
        const fineTuneResponse = await client.createFineTuneJob(jsonFile);
        console.log('Fine-tuning job created successfully:', fineTuneResponse);
    }
    catch (error) {
        console.error("Error in run function:", error);
    }
}

await run(content, instructions).then(() => {
    console.log("Fine-tuning process completed successfully.");
}).catch((error) => {
    console.error("Error during fine-tuning process:", error);
});