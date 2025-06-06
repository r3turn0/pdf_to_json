const OpenAI = require('openai');
const fs = require('fs');
const { resolve } = require('path');
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
        const openai = this.client;
        return new Promise((resolve, reject) => {
            (async function() {
            await openai.files.create({
                file: fs.createReadStream(filePath),
                purpose: 'fine-tune',
            }).then((response) => {
                const file_Id = response.id;
                console.log("File uploaded successfully. File ID:", file_Id);
                resolve(file_Id);
            }).catch((error) => {
                console.error("Error uploading file:", error);
                reject(error);
            });
        })(openai);
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
                training_file: fileId, 
                model: process.env.MODEL || 'gpt-4o'
            }).then((response) => {
                resolve(response)
            }).catch((error) => {
                console.log("Error creating fine-tune job:", error);
                reject(error);
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
        const instructions = o.instructions ? instruct + '\n' + o.instructions : instruct; // Give it an algorithm to follow from index.js
        // Query the database table later for the fields for now hardcode them in the input.
        const i =  `Given the following fields with field types: ['Item Name VARCHAR', 'Vendor Item Code VARCHAR',
                   'Packaging Information VARCHAR', 'Unit of Measure FLOAT', 'Unit/Box NUMERIC', 'Item Color VARCHAR', 'Item Size VARCHAR',
                   'PCs in a Box NUMERIC', 'SF by PC/SHEET NUMERIC', 'SF By Box NUMERIC', 'Cost FLOAT', 'Group VARCHAR', 'Finish VARCHAR'] and 
                    given pageNumbers and lineItems (aka the data) associated for each page find the correct values for the fields above.`;
        const input = o.input ? i + '\n' + o.input : i;
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
                                    //PTM POLISHED, PTM1,	1.00 SF/EA,	SHEET, 1, "CALACATTA, THASSOS , BRASS", 1.00, 33.00, MOSAIC
                                    // PTM POLISHED, PTM2,	0.90 SF/EA,	SHEET, 1, "THASSOS, NERO MARQUINA", 0.90,	23.40, MOSAIC
                                    // PTM POLISHED, PTM3,	0.90 SF/EA,	SHEET, 1, "CALACATTA GOLD, THASSOS, NERO MARQUINA , BRASS", 0.90,	29.70, MOSAIC
                                    // PTM POLISHED, PTM4,	0.90 SF/EA,	SHEET, 1, "ASIAN STATUARY, THELA GREY", 0.90,	24.30, MOSAIC
                                    // PTM POLISHED, PTM5,	0.90 SF/EA,	SHEET, 1, "CALACATTA GOLD , BRASS", 0.90,	28.80, MOSAIC
                                    // PTM POLISHED, PTM6,	1.00 SF/EA,	SHEET, 1, "CALACATTA GOLD, NERO MARQUINA , BRASS", 1.00, 30.00, MOSAIC
                                    type: 'input_text',
                                    text: process.env.EXAMPLES + `\n I want ALL records (full file) to be returned in the CSV format. Consider this as confirmation.`
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
        try {
            return new Promise((resolve, reject)=> {
                const openai = this.client;
                (async function() {
                const thread = await openai.beta.threads.create({
                    messages: [
                        {
                            role: 'user',
                            content: content
                        },
                    ]
                }).then((response) => {
                    console.log("Thread created successfully:", response);
                    return response;
                }).catch((error)=> {
                    console.error("Error creating thread:", error);
                    return reject(error);
                });
                if(thread) {
                    resolve(thread)
                }
                })(openai);
            });
        }
        catch (error) {
            console.error("Error in createThread function:", error);
        }
    }

    runThread(threadId, aid, instructions) {
        try {
            return new Promise((resolve, reject) => {
                const openai = this.client;
                (async function() { 
                    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
                        assistant_id: aid,
                        additional_instructions: instructions,
                        tools: [{
                            type: "file_search"
                        }]
                    }).then((response) => {
                        return response;
                    }).catch((error) => {
                        console.error("Error running thread:", error);
                        return reject(error);
                    });
                    if(run) {
                        console.log("Thread run completed successfully:", run);
                        resolve(run);
                    }
                })(openai);
            });
        }
        catch (error) {
            console.error("Error in runThread function:", error);
        }
    }

    // // returns message thread ids
    createMessage(threadId, fileId) {
        try {
            const openai = this.client
            return new Promise((resolve, reject) => {
            (async function() {
                const msg = openai.beta.threads.messages.create(threadId, {
                        role: 'user', 
                        content: process.env.EXAMPLES,
                        attachments: [
                            { 
                                file_id: fileId, 
                                tools: [{ type: 'file_search' }] 
                            },
                            
                        ]
                    }).then((response) => {
                    console.log("Message created successfully:", response);
                    return response;
                }).catch((error) => {
                    console.error("Error creating message:", error);
                    reject(error);
                });
                if(msg) {
                    resolve(msg);
                }
                else {
                    console.log("Error in createMessage function: No messages found.");
                }
            })(openai);
        });
        }
        catch (error) {
            console.log("Error in getThread function:", error);
        }
    }

    getMessage(m, threadId) {
        try {
            const openai = this.client;
            const messageId = m.id;
            const o = {
                openai: openai,
                messageId: messageId,
                threadId: threadId
            }
            return new Promise((resolve, reject) => {
            (async function() {
                const message = await o.openai.beta.threads.messages.retrieve(o.threadId, o.messageId).then((response) => {
                    if(response) {
                        return response;
                    }
                }).catch((error) => {
                    console.log("Error retrieving message:", error);
                    reject(error);
                }); 
                if(message) {
                    console.log("Message retrieved:", message)
                    resolve(message);
                }
                else {
                    console.log("Error in getMessage function: No message found.");
                }
            })(o);
            });
        }
        catch(error){
            console.error("Error in getMessage function:", error);
        }
    } 
}

module.exports = OpenAIClient;