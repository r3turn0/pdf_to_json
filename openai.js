const OpenAI = require('openai');
const fs = require('fs');

class OpenAIClient {
    
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.client = new OpenAI({
            apiKey: this.apiKey
        });
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

    // Method to create a response using the OpenAI API
    createResponse(o, f, pdf) {
        const file = f.file ? f.file : 'pdf/' + pdf;
        const fileID = f.fileID ? f.fileID : null;
        const data = fs.readFileSync(file);
        console.log('Reading file:', file);
        const base64 = data.toString('base64');
        //const base64 = data.toString('utf8');
        console.log("Base64 data:", base64);
        const model = o.model || 'gpt-4o';
        const instruct = `You are a data analyst able to read and analyze data from PDF, Excel and CSV files. 
                          You will be provided with unstructured tabular data and your task is to analyze the data and infer values based on the fields given.`;
        const instructions = o.instructions ? instruct + '\n' + o.instructions : instruct; 
        // Query the database table later for the fields for now hardcode them in the input.
        const i = `Given the following fields with field types: ['Item Name VARCHAR', 'Vendor Item Code VARCHAR',
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
                                    file_data: `data:application/pdf;base64,${base64}`    
                                    //file_id: file_Id
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
                                    Item Name, Vendor Item Code, Sales Description,	Unit of Measure, Unit/Box, Item Color, Item Size, PCs in a Box,	SF by PC/SHEET,	SF By Box, Cost, Group
                                    PTM POLISHED,	PTM1,	1.00 SF/EA,	SHEET,	1,	"CALACATTA, THASSOS , BRASS", 1.00, 33.00, MOSAIC
                                    PTM POLISHED,	PTM2,	0.90 SF/EA,	SHEET,	1,	"THASSOS, NERO MARQUINA", 0.90,	23.40, MOSAIC
                                    PTM POLISHED,	PTM3,	0.90 SF/EA,	SHEET,	1,	"CALACATTA GOLD, THASSOS, NERO MARQUINA , BRASS", 0.90,	29.70, MOSAIC
                                    PTM POLISHED,	PTM4,	0.90 SF/EA,	SHEET,	1,	"ASIAN STATUARY, THELA GREY", 0.90,	24.30, MOSAIC
                                    PTM POLISHED,	PTM5,	0.90 SF/EA,	SHEET,	1,	"CALACATTA GOLD , BRASS", 0.90,	28.80, MOSAIC
                                    PTM POLISHED,	PTM6,	1.00 SF/EA,	SHEET,	1,	"CALACATTA GOLD, NERO MARQUINA , BRASS", 1.00, 30.00, MOSAIC.`
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
}

module.exports = OpenAIClient;