// https://github.com/saikksub/node-docx-tables
// Some changes were made to parse a docx table correctly.

'use strict'

import { readFile, existsSync } from 'fs';
import pkg from 'jszip';
const { loadAsync } = pkg;
import { Parser } from 'xml2js';


/**
 * Load and Extract given docx file
 */
async function loadFile(file) {
  return new Promise((resolve, reject) => {
    readFile(file, function (err, data) {
      if (err) {
        reject(err)
      }
      loadAsync(data).then(function (zip) {
        resolve(zip)
      }).catch((error) => {
        reject(error)
      })
    })
  })
}

/**
 * Main Logic for extracting Table data from XML JSON data
 */
function parseTables(xmlJsonData) {
  const tables = []
  try {
    let wTable = xmlJsonData['w:document']['w:body']['w:tbl']
    if (wTable) {
      if (wTable.constructor !== [].constructor) {
        wTable = [wTable]
      }
      wTable.forEach((wTableItem) => {
        const result = {}
        const wTableItemRow = wTableItem['w:tr']
        wTableItemRow.forEach((wTableItemRowItem, rowIndex) => {
          const wTableItemRowColumn = wTableItemRowItem['w:tc']
          const rowObject = []
          wTableItemRowColumn.forEach((wTableItemRowColumnItem, colIndex) => {
            let wp = wTableItemRowColumnItem['w:p']
            if (wp) {
              if (wp.constructor !== [].constructor) {
                wp = [wp]
              }
              let data = ''
              wp.forEach((wpItem) => {
                let paragraphText = "";

                // Normalize runs (some paragraphs have an array, some don’t)
                const runs = wpItem["w:r"]
                  ? (Array.isArray(wpItem["w:r"]) ? wpItem["w:r"] : [wpItem["w:r"]])
                  : [];

                runs.forEach(run => {
                  // Handle text inside <w:t>
                  if (run["w:t"]) {
                    if (typeof run["w:t"] === "string") {
                      paragraphText += run["w:t"];
                    } else if (run["w:t"]["_text"]) {
                      paragraphText += run["w:t"]["_text"];
                    } else if (typeof run["w:t"]["#text"] === "string") {
                      paragraphText += run["w:t"]["#text"];
                    }
                  }

                  // Some text may be inside nested tags (like hyperlinks)
                  if (run["w:hyperlink"] && run["w:hyperlink"]["w:t"]) {
                    paragraphText += run["w:hyperlink"]["w:t"];
                  }
                });

                if (paragraphText.trim()) {
                  data += paragraphText + "\n";
                }
              });
              //if (data) {
              rowObject.push({
                position: {
                  row: rowIndex,
                  col: colIndex
                },
                data
              })
              //}
            }
            // console.log('++++++++++++++++++')
          })
          //if (rowObject && rowObject.constructor === [].constructor && rowObject.length > 0) {
          result[`${rowIndex}`] = Object.assign([], rowObject)
          //}
          // console.log('==========================')
        })
        tables.push(result)
      })
    }
  } catch (error) {
    return error
  }

  return tables
}

// Function to remove Byte Order Mark (BOM) if it exists
function removeBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

function getFirstLine(xmlJsonData) {
  try {
    const body = xmlJsonData['w:document']['w:body'];
    const paragraphs = body['w:p'];

    if (!paragraphs) return "";

    // Get the first paragraph object (not the array itself)
    const firstParagraph = Array.isArray(paragraphs) ? paragraphs[0] : paragraphs;

    const firstRun = firstParagraph['w:r'];
    if (!firstRun) return "";

    // Get the text (either direct string or inside _text)
    let text = "";
    if (Array.isArray(firstRun)) {
      text = firstRun
        .map(r => (r['w:t']?._text || r['w:t'] || ""))
        .join(" ")
        .trim();
    } else {
      text = firstRun['w:t']?._text || firstRun['w:t'] || "";
    }

    return text.trim();
  } catch (e) {
    console.error("Error in getFirstLine:", e);
    return "";
  }
}

export default function (props) {
  return new Promise((resolve, reject) => {
    if (!(props && props.constructor === {}.constructor)) {
      reject(new Error(`Invalid Props`))
    }
    if (!props.file) {
      reject(new Error(`Object prop "file" is required.`))
    }
    if (!existsSync(props.file)) {
      reject(new Error(`Input file "${props.file}" does not exists. Please provide valid file.`))
    }
    // Load and extract docx file
    loadFile(props.file).then((data) => {
      const documentKey = Object.keys(data.files).find(key => /word\/document.*\.xml/.test(key))

      if (data.files[documentKey]) {
        data.files[documentKey].async("text").then(function (content) {

          const parser = new Parser({ explicitArray: false, ignoreAttrs: false })
          parser.parseString(content, (err, result) => {
            if (err) {
              throw err;
            }

            let xmlJsonData = JSON.stringify(result, null, 4);

            // Make sure parsed XML file is an object
            if (typeof xmlJsonData === 'string') {
              xmlJsonData = JSON.parse(xmlJsonData)
            }

            const title = getFirstLine(xmlJsonData)

            const res = parseTables(xmlJsonData)
            // console.log(JSON.stringify(res, null, 3));
            resolve({
              title,
              tables: res
            })
          })
        })
      } else {
        resolve({})
      }
    }).catch((error) => {
      reject(error)
    })
  })
}

// import util from "util";
// import libre from "libreoffice-convert";
// libre.convertAsync = util.promisify(libre.convert);

// /**
//  * Convert a .doc file to .docx and parse it into rubric JSON
//  * @param {string} inputPath - Path to the uploaded .doc file
//  * @returns {Promise<Object>} rubricJSON
//  */
// export async function parseDOC(inputPath) {
//   try {
//     // Output path: same folder, with .converted.docx suffix
//     const outputPath = inputPath + ".converted.docx";

//     // Read, convert, and write the DOCX
//     const docBuf = await fs.promises.readFile(inputPath);
//     const docxBuf = await libre.convertAsync(docBuf, ".docx", undefined);
//     await fs.promises.writeFile(outputPath, docxBuf);
//     console.log("DOC converted to DOCX successfully!");

//     // Parse the converted DOCX
//     const { title, tables } = await parseDOCX({ file: outputPath });
//     const rubricJSON = transformTableToRubric(tables, title, {
//       originalname: path.basename(outputPath),
//     });

//     return rubricJSON;
//   } catch (err) {
//     console.error("Error converting/parsing DOC:", err);
//     throw err;
//   }
// }