const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config();

class OpenAIClient {
    
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.client = new OpenAI({
            apiKey: this.apiKey
        });
        this.assistant_id = process.env.ASSISTANTID;
    }

    // Method to upload a file to OpenAI then get the file ID to use it in the createResponse method
    uploadFile(filePath) {
        return new Promise((resolve, reject) => {
            this.client.files.create({
                file: fs.createReadStream(filePath),
                purpose: 'user_data'
            }).then((response) => {
                const file_Id = response.id;
                console.log("File uploaded successfully. File ID:", file_Id);
                resolve(file_Id);
            }).catch((error) => {
                console.error("Error uploading file:", error);
                reject(error);
            });
        });            
    }

    // Method to upload a file for fine-tuning, file must be in JSONL format
    uploadTuningFile(filePath) {
        return new Promise((resolve, reject) => {
            this.client.files.create({
                file: fs.createReadStream(filePath),
                purpose: 'fine-tune'
            }).then((response) => {
                const file_Id = response.id;
                console.log("File uploaded successfully. File ID:", file_Id);
                resolve(file_Id);
            }).catch((error) => {
                console.error("Error uploading file:", error);
                reject(error);
            });
        });            
    }

    retrieveFile(fileId) {
        return new Promise((resolve, reject) => {
            this.client.files.retrieve(fileId).then((response) => {
                console.log("File retrieved successfully:", response);
                resolve(response);
            }).catch((error) => {
                console.error("Error retrieving file:", error);
                reject(error);
            });
        });
    }

    createFineTuneJob(fileId) {
        return new Promise((resolve, reject) => {
            this.client.fineTuning.jobs.create(
            { 
                model: process.env.MODEL || 'gpt-4o', 
                training_file: fileId 
            });
        });
    }

    // Method to create a response using the OpenAI API
    createResponse(o, fo, pdf) {
        const file = fo.file ? fo.file : 'pdf/' + pdf;
        const fileID = fo.fileID ? fo.fileID : null;
        const data = fs.readFileSync(file);
        console.log('Reading file:', file);
        const base64 = data.toString('base64');
        //const base64 = data.toString('utf8');
        console.log("Base64 data:", base64);
        const model = process.env.MODEL || 'gpt-4o';
        const instruct = `You are a data analyst able to read, analyze and extract data from PDF, Excel and CSV files. 
                          You will be provided with unstructured tabular data and your task is to analyze the data and infer values based on the fields given.
                          Respond only with a CSV table, without any explanation, summary, or commentary. Do not add any introductory or concluding text.`;
        const instructions = o.instructions ? instruct + '\n' + o.instructions : instruct; 
        // Query the database table later for the fields for now hardcode them in the input.
        const i =  `Given the following fields with field types: ['Item Name VARCHAR', 'Vendor Item Code VARCHAR',
                   'Sales Description VARCHAR', 'Unit of Measure FLOAT', 'Unit/Box NUMERIC', 'Item Color VARCHAR', 'Item Size VARCHAR',
                   'PCs in a Box NUMERIC', 'SF by PC/SHEET NUMERIC', 'SF By Box NUMERIC', 'Cost FLOAT', 'Group VARCHAR'] and 
                    given pageNumbers and lineItems (aka the data) associated for each page find the correct values for the fields above.`;
        const input = o.input ? o.input + input : i;
        return new Promise((resolve, reject) => {  
            this.client.responses.create({
                model: model,
                instructions: instructions,
                input: [
                    {
                        role: 'user',
                        content: [ 
                                {
                                    type: 'input_file',
                                    filename: file,
                                    file_data: `data:application/pdf;base64,${base64}`,    
                                    file_id: fileID
                                },
                            ]
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'input_text',
                                    text: input
                                }
                            ]
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'input_text',
                                    text: `Here are some sample values that I am looking for: 
                                    Item Name, Vendor Item Code, Packaging Information	Unit of Measure, Unit/Box, Item Color, Item Size, PCs in a Box,	SF by PC/SHEET,	SF By Box, Cost, Group, Finish
                                    PTM POLISHED, PTM1,	1.00 SF/EA,	SHEET, 1, "CALACATTA, THASSOS , BRASS", 1.00, 33.00, MOSAIC
                                    PTM POLISHED, PTM2,	0.90 SF/EA,	SHEET, 1, "THASSOS, NERO MARQUINA", 0.90,	23.40, MOSAIC
                                    PTM POLISHED, PTM3,	0.90 SF/EA,	SHEET, 1, "CALACATTA GOLD, THASSOS, NERO MARQUINA , BRASS", 0.90,	29.70, MOSAIC
                                    PTM POLISHED, PTM4,	0.90 SF/EA,	SHEET, 1, "ASIAN STATUARY, THELA GREY", 0.90,	24.30, MOSAIC
                                    PTM POLISHED, PTM5,	0.90 SF/EA,	SHEET, 1, "CALACATTA GOLD , BRASS", 0.90,	28.80, MOSAIC
                                    PTM POLISHED, PTM6,	1.00 SF/EA,	SHEET, 1, "CALACATTA GOLD, NERO MARQUINA , BRASS", 1.00, 30.00, MOSAIC
                                    Acacia Valley FLoor Tile Plank, 6361P6, 12.78 SF/BOX, SQUARE FOOT, 1, 12.78, 'Ash, Ark, Ridge', 6X36, 12.78, 72.85, 12.78, Acacia Valley, 5.7, TILE, MATTE
                                    ACREAGE Floor Tile Plank Matte, PLK848MT, 15.18 SF/BOX, SQUARE FOOT, 1, 15.18, Palomino, 8X48, 25.29, 15.18, 1.66, Tile, MATTE.
                                    I want ALL records (full file) to be returned in the CSV format. Consider this as confirmation.`
                                }
                            ]
                        }
                    ],
            }).then((response) => {
                //const result = response.choices[0].message.content;
                resolve(response);
            }).catch((error) => {
                console.error("Error creating OpenAI response:", error);
                reject(error);
            });
        });
    }

    createThread(content) {
        (async function() {
            const thread = await this.client.beta.assistants.createThread({
                messages: [
                    {
                        role: 'user',
                        content: content
                    },
                    // {
                    //     role: 'user',
                    //     content: content2
                    // }
                ]
            });
            return thread;
        })();
    }

    runThread(threadId, aid, instructions) {
        (async function() { 
            const run = await this.client.beta.assistants.createAndPollThread(threadId, {
                assistant_id: aid,
                additional_instructions: instructions,
                tools: [{
                    type: "file_search",
                    vector_store_ids: [process.env.VECTORSTOREID],
                }]
            });
            return run;
        })();
    }

    getThread(threadId) {
        (async function() {
           if (run.status == 'completed') {
            const messages = await openai.beta.threads.messages.list(threadId);
            for (const message of messages.getPaginatedItems()) {
                console.log(message);
            }
            return messages;
        } 
        })();
    }
}

module.exports = OpenAIClient;