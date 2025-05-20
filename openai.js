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
    createResponse(o, file_Id) {
        const model = o.model || 'gpt-4o';
        const instruct = `You are a data analyst able to read and analyze data from PDF, Excel and CSV files. 
                                                You will be provided with a txt containing data from the file. 
                                                Your task is to analyze the data and infer values based on the fields given.`;
        const instructions = o.instructions ? instruct + '\n' + o.instructions : instruct; 
        // Query the database table later for the fields for now hardcode them in the input.
        const i = `Given the following fields: ['Item Name', 'Vendor Item Code',
                        'Sales Description', 'Unit of Measure', 'Unit/Box', 'Item Color', 'Item Size',
                        'PCs in a Box', 'SF by PC/SHEET', 'SF By Box', 'Cost', 'Group'] and 
                        given pageNumbers and lineItems (aka the data) associated for each page find the correct values for the fields above.`;
        const input = o.input ? o.input + input : i;
        return new Promise((resolve, reject) => {  
            this.client.responses.create({
                model: model,
                instructions: instructions,
                input: [
                    {
                        role: 'user',
                        content: [ {
                                    type: 'input_file',
                                    file_id: file_Id,    
                                },
                                {
                                    type: 'input_text',
                                    text: input,
                                }
                        ]
                    }
                ],
            }).then((response) => {
                const result = response.choices[0].message.content;
                resolve(result);
            }).catch((error) => {
                console.error("Error creating OpenAI response:", error);
                reject(error);
            });
        })
    }
}

module.exports = OpenAIClient;