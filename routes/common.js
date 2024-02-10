const { collections } = require("../db/config");
const SortOptions = {
    best: "best",
    recent: "recent"
}

module.exports = {
    aggregateSchemaValidationErrors: function (mongServerError) {
        let validationErrorMsg = "";
        mongServerError.errInfo.details.schemaRulesNotSatisfied.map(rule => {
            if (rule.missingProperties) {
                let fields = rule.missingProperties.length > 1 ? 'are' : 'is';
                validationErrorMsg += `${rule.missingProperties.join(",")} ${fields} ${rule.operatorName}`
            }
            if (rule.propertiesNotSatisfied) {
                let fields = rule.propertiesNotSatisfied.length > 1 ? 'are' : 'is';
                let blankFields = rule.propertiesNotSatisfied.reduce((allFields, currField) => { allFields.push(currField.propertyName); return allFields }, [])
                validationErrorMsg += `${blankFields.join(",")} ${fields} are required`
            }
        })
        return {
            error: {
                description: validationErrorMsg,
                type: 'schema_validation'
            }
        };
    },
    getNextSequence: async function (name, db) {
        const result = await db.collection(collections.counters).findOneAndUpdate(
            { "_id": name },
            { $inc: { "seq": 1 } },
            {
                returnDocument: 'after',
                upsert: true
            }
        );
        return result.seq;
    },
    rollBackSequence: async function (name, db) {
        const result = await db.collection(collections.counters).findOneAndUpdate(
            { "_id": name },
            { $inc: { "seq": -1 } },
            {
                returnDocument: 'after',
                upsert: true
            }
        );
        return result.seq;
    },
    SortOptions,
}
