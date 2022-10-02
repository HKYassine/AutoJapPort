const sqlite3 = require("sqlite3")
const path = require("path")
const db_jap = new sqlite3.Database(path.resolve('./databases/db_jap.db'),sqlite3.OPEN_READONLY,(err)=>{
})
const db_glo = new sqlite3.Database(path.resolve('./databases/db_glo.db'),sqlite3.OPEN_READONLY,(err)=>{ 
})
const applied_targets = []
const applied_causality = []
async function query(query,db){
    return new Promise(function(resolve,reject){
        db.all(query, function(err,rows){
           if(err){return reject(err);}
           resolve(rows);
         });
    });
}
async function sub_target_type(skill){
    let SQLCode = ""
    let target_type_set_glo = await query(`SELECT * FROM sub_target_type_sets WHERE id=${skill.sub_target_type_set_id}`,db_glo)
    let target_type_set_jap = await query(`SELECT * FROM sub_target_type_sets WHERE id=${skill.sub_target_type_set_id}`,db_jap)
    target_type_set_jap = target_type_set_jap[0]
    if (target_type_set_glo.length === 0){
        SQLCode = SQLCode + `INSERT OR REPLACE INTO sub_target_type_sets(id,created_at,updated_at) VALUES(${target_type_set_jap.id},'${target_type_set_jap.created_at}','${target_type_set_jap.updated_at}');\n`
    }
    let target_type_glo = await query(`SELECT * FROM sub_target_types WHERE sub_target_type_set_id=${skill.sub_target_type_set_id}`,db_glo)
    let target_type_jap = await query(`SELECT * FROM sub_target_types WHERE sub_target_type_set_id=${skill.sub_target_type_set_id}`,db_jap)
    if (target_type_glo.length === 0){
        for (let index = 0; index < target_type_jap.length; index++) {
            const target = target_type_jap[index];
            SQLCode = SQLCode + `INSERT OR REPLACE INTO sub_target_types(id,sub_target_type_set_id,target_value_type,target_value,created_at,updated_at) VALUES(${target.id},${target.sub_target_type_set_id},${target.target_value_type},${target.target_value},'${target.created_at}','${target.updated_at}');\n`
        }
    }
    applied_targets.push(skill.sub_target_type_set_id)
    return SQLCode
    


}
async function causality(condition){
    SQLCODE = ""
    condition = parseInt(condition.replaceAll(`'{"source":"`,"").replaceAll(`","`,"").replaceAll(`compiled"`,"").replaceAll(`}'`,"").split(":")[0])
    let condition_glo = await query(`SELECT * FROM skill_causalities WHERE id=${condition}`,db_glo)
    let condition_jap = await query(`SELECT * FROM skill_causalities WHERE id=${condition}`,db_jap)
    condition_jap = condition_jap[0]
    if (condition_glo.length === 0){
        SQLCODE = SQLCODE + `INSERT OR REPLACE INTO skill_causalities(id,causality_type,cau_val1,cau_val2,cau_val3,created_at,updated_at) VALUES (${condition_jap.id},${condition_jap.causality_type},${condition_jap.cau_val1},${condition_jap.cau_val2},${condition_jap.cau_val3},'${condition_jap.created_at}','${condition_jap.updated_at}');\n`
    }
    return SQLCODE


}
async function importPassive(card,name,description,transfo_cond){
    let passiveID = card.passive_skill_set_id
    let SQLCode = ""
    let passiveRelations = await query(`SELECT * FROM passive_skill_set_relations WHERE passive_skill_set_id=${passiveID}`,db_jap)
    let param_no = []
    SQLCode = SQLCode + `INSERT OR REPLACE INTO passive_skill_sets(id,name,description,created_at,updated_at) VALUES(${passiveID},'${name}','${description}','${card.open_at}','${card.updated_at}');\n`
    let passivesID = []
    for (let index = 0; index < passiveRelations.length; index++) {
        const relation = passiveRelations[index];
        SQLCode = SQLCode + `INSERT OR REPLACE INTO passive_skill_set_relations(id,passive_skill_set_id,passive_skill_id,created_at,updated_at) VALUES(${relation.id},${relation.passive_skill_set_id},${relation.passive_skill_id},'${relation.created_at}','${relation.updated_at}');\n`
        passivesID.push(relation.passive_skill_id)
    }
    

    for (let index = 0; index < passivesID.length; index++) {
        const passive = passivesID[index];
        let passiveinJap = await query(`SELECT * FROM passive_skills WHERE id=${passive}`,db_jap)
        passiveinJap = passiveinJap[0]
        if (typeof passiveinJap.causality_conditions === "string") {
            passiveinJap.causality_conditions = `'${passiveinJap.causality_conditions}'`
            if (!applied_causality.includes(passiveinJap.causality_conditions)){
                SQLCode = SQLCode + await causality(passiveinJap.causality_conditions)
            applied_causality.push(passiveinJap.causality_conditions)
            }
            
        } 
        if (passiveinJap.efficacy_type === 103) {
            param_no.push(passiveinJap.eff_value3)
            let transfodesc = await query(`SELECT * FROM transformation_descriptions WHERE skill_id=${passiveinJap.id}`,db_jap)
            transfodesc = transfodesc[0]
            SQLCode = SQLCode + `INSERT OR REPLACE INTO transformation_descriptions(id,skill_type,skill_id,description,created_at,updated_at) VALUES(${transfodesc.id},'PassiveSkill',${transfodesc.id},'${transfo_cond}','${transfodesc.created_at}','${transfodesc.updated_at}');\n`

        }
        SQLCode = SQLCode + `INSERT OR REPLACE INTO passive_skills(id,name,description,exec_timing_type,efficacy_type,target_type,sub_target_type_set_id,passive_skill_effect_id,calc_option,turn,is_once,probability,causality_conditions,eff_value1,eff_value2,eff_value3,created_at,updated_at) VALUES(${passiveinJap.id},'${name}','${passiveinJap.description}',${passiveinJap.exec_timing_type},${passiveinJap.efficacy_type},${passiveinJap.target_type},${passiveinJap.sub_target_type_set_id},${passiveinJap.passive_skill_effect_id},${passiveinJap.calc_option},${passiveinJap.turn},${passiveinJap.is_once},${passiveinJap.probability},${passiveinJap.causality_conditions},${passiveinJap.eff_value1},${passiveinJap.eff_value2},${passiveinJap.eff_value3},'${passiveinJap.created_at}','${passiveinJap.updated_at}');\n`
        if (passiveinJap.sub_target_type_set_id !== 0 && !applied_targets.includes(passiveinJap.sub_target_type_set_id)){
            SQLCode = SQLCode + await sub_target_type(passiveinJap)
        }
        if (passiveinJap.passive_skill_effect_id !== null){
            let effectGlo = await query(`SELECT * FROM passive_skill_effects WHERE id=${passiveinJap.passive_skill_effect_id}`,db_glo)
            let effectJap = await query(`SELECT * FROM passive_skill_effects WHERE id=${passiveinJap.passive_skill_effect_id}`,db_jap)
            effectJap = effectJap[0]
            if (effectGlo.length === 0){
                SQLCode = SQLCode + `INSERT OR REPLACE INTO passive_skill_effects(id,script_name,lite_flicker_rate,bgm_id,created_at,updated_at) VALUES(${effectJap.id},'${effectJap.script_name}',${effectJap.lite_flicker_rate},${effectJap.bgm_id},'${effectJap.created_at}','${effectJap.updated_at}');\n`
            }

        }
    }
    return {
        SQLCode: SQLCode,
        param_no: param_no
    }

    
}
async function importLeader(card,name,description){
    let SQLCode = ""
    SQLCode = SQLCode + `INSERT OR REPLACE INTO leader_skill_sets(id,name,description,created_at,updated_at) VALUES(${card.leader_skill_set_id},'${name}','${description}','${card.created_at}','${card.updated_at}');\n`
    let leaderSkill_r = await query(`SELECT * FROM leader_skills WHERE leader_skill_set_id=${card.leader_skill_set_id}`,db_jap)
    for (let index = 0; index < leaderSkill_r.length; index++) {
        const skill = leaderSkill_r[index];
        if (typeof skill.causality_conditions === "string") {
            var causality_conditions = `'${skill.causality_conditions}'`
            if (!applied_causality.includes(causality_conditions)){
                SQLCode = SQLCode + await causality(causality_conditions)
            applied_causality.push(causality_conditions)
        }
        } else var causality_conditions = skill.causality_conditions
        SQLCode = SQLCode + `INSERT OR REPLACE INTO leader_skills(id,leader_skill_set_id,exec_timing_type,target_type,sub_target_type_set_id,causality_conditions,efficacy_type,efficacy_values,calc_option,created_at,updated_at) VALUES(${skill.id},${skill.leader_skill_set_id},${skill.exec_timing_type},${skill.target_type},${skill.sub_target_type_set_id},${causality_conditions},${skill.efficacy_type},'${skill.efficacy_values}',${skill.calc_option},'${skill.created_at}','${skill.updated_at}');\n` 
        if (skill.sub_target_type_set_id !== 0 && !applied_targets.includes(skill.sub_target_type_set_id)){
            SQLCode = SQLCode + await sub_target_type(skill)
            applied_targets.push(skill.sub_target_type_set_id)
        }
    }
    return SQLCode
}
async function importSAs(card,translatedcard,appliedSAs,viewIDS){
        const apply = []
        let SQLCode = ""
        let SAs = await query(`SELECT * FROM card_specials WHERE card_id=${card.id}`,db_jap)
        let index_normal = 0
        let index_hyper = 0
        for (let index = 0; index < SAs.length; index++) {
            const SA = SAs[index];
            if (appliedSAs.includes(SA.special_set_id)) continue;
                if (SA.style === "Hyper"){
                    var SAtrans = translatedcard.SAs_Ultime[index_hyper]
                    index_hyper++
                }
                if (SA.style === "Normal"){
                    if (SA.lv_start === 14 || SA.lv_start === 19){
                        var SAtrans = translatedcard.SAs[0]
                        index_normal++
                    } else {
                        var SAtrans = translatedcard.SAs[index_normal]
                        index_normal++
                    }
                    
                }
                if (SA.style === "Condition"){
                        var SAtrans = translatedcard.SAs[index]
                }
                apply.push(SA.special_set_id)
                var causality_conditions = null
                var special_asset_id = null
                if (SA.special_asset_id !== null) special_asset_id = SA.special_asset_id
                if (SA.causality_conditions !== null) {
                    causality_conditions = `'${SA.causality_conditions}'`
                    if (!applied_causality.includes(causality_conditions)){
                    SQLCode = SQLCode + await causality(causality_conditions)
                    applied_causality.push(causality_conditions)  
                    }
                }
                SQLCode = SQLCode + `INSERT OR REPLACE INTO card_specials(id,card_id,special_set_id,priority,style,lv_start,eball_num_start,view_id,card_costume_condition_id,special_bonus_id1,special_bonus_lv1,bonus_view_id1,special_bonus_id2,special_bonus_lv2,bonus_view_id2,causality_conditions,special_asset_id,created_at,updated_at) VALUES(${SA.id},${SA.card_id},${SA.special_set_id},${SA.priority},'${SA.style}',${SA.lv_start},${SA.eball_num_start},${SA.view_id},${SA.card_costume_condition_id},${SA.special_bonus_id1},${SA.special_bonus_lv1},${SA.bonus_view_id1},${SA.special_bonus_id2},${SA.special_bonus_lv2},${SA.bonus_view_id2},${causality_conditions},${special_asset_id},'${SA.created_at}','${SA.updated_at}');\n`
                viewIDS.push(SA.view_id)
                let specialSet = await query(`SELECT * FROM special_sets WHERE id=${SA.special_set_id}`,db_jap)
                specialSet = specialSet[0]
                if (SAtrans.condition !== null) var condition = `'${SAtrans.condition}'`
                else var condition = null
                SQLCode = SQLCode + `INSERT OR REPLACE INTO special_sets(id,name,description,causality_description,aim_target,increase_rate,lv_bonus,created_at,updated_at) VALUES(${specialSet.id},'${SAtrans.name}','${SAtrans.effect}',${condition},${specialSet.aim_target},${specialSet.increase_rate},${specialSet.lv_bonus},'${specialSet.created_at}','${specialSet.updated_at}');\n`
                let specials = await query(`SELECT * FROM specials WHERE special_set_id=${SA.special_set_id}`,db_jap)
                for (let index = 0; index < specials.length; index++) {
                    const special = specials[index];
                    SQLCode = SQLCode + `INSERT OR REPLACE INTO specials(id,special_set_id,type,efficacy_type,target_type,calc_option,turn,prob,causality_conditions,eff_value1,eff_value2,eff_value3,created_at,updated_at) VALUES(${special.id},${special.special_set_id},'${special.type}',${special.efficacy_type},${special.target_type},${special.calc_option},${special.turn},${special.prob},${special.causality_conditions},${special.eff_value1},${special.eff_value2},${special.eff_value3},'${special.created_at}','${special.updated_at}');\n`       
                }      

        }
        return {
            SQLCode: SQLCode,
            viewIDS: viewIDS,
            appliedSAs: apply
        }
}

async function importAS(card,as_cond,as_name,as_effect){
    let viewIDS = []
    let SQLCode = ""
    let param_no = []
    let activeSkill = await query(`SELECT * FROM card_active_skills WHERE card_id=${card.id}`,db_jap)
    activeSkill = activeSkill[0]
    SQLCode = SQLCode + `INSERT OR REPLACE INTO card_active_skills(id,card_id,active_skill_set_id,created_at,updated_at) VALUES(${activeSkill.id},${activeSkill.card_id},${activeSkill.active_skill_set_id},'${activeSkill.created_at}','${activeSkill.updated_at}');\n`
                let activeSkillSet = await query(`SELECT * FROM active_skill_sets WHERE id=${activeSkill.active_skill_set_id}`,db_jap)
                activeSkillSet = activeSkillSet[0]
                SQLCode = SQLCode + `INSERT OR REPLACE INTO active_skill_sets(id,name,effect_description,condition_description,turn,exec_limit,causality_conditions,ultimate_special_id,special_view_id,costume_special_view_id,bgm_id,created_at,updated_at) VALUES(${activeSkillSet.id},'${as_name}','${as_effect}','${as_cond}',${activeSkillSet.turn},${activeSkillSet.exec_limit},'${activeSkillSet.causality_conditions}',${activeSkillSet.ultimate_special_id},${activeSkillSet.special_view_id},${activeSkillSet.costume_special_view_id},${activeSkillSet.bgm_id},'${activeSkillSet.created_at}','${activeSkillSet.updated_at}');\n`
                viewIDS.push(activeSkillSet.special_view_id)
                let actives = await query(`SELECT * FROM active_skills WHERE active_skill_set_id=${activeSkill.active_skill_set_id}`,db_jap)
                for (let index = 0; index < actives.length; index++) {
                    const active = actives[index];
                    SQLCode = SQLCode + `INSERT OR REPLACE INTO active_skills(id,active_skill_set_id,target_type,sub_target_type_set_id,calc_option,efficacy_type,eff_val1,eff_val2,eff_val3,thumb_effect_id,effect_se_id,created_at,updated_at) VALUES(${active.id},${active.active_skill_set_id},${active.target_type},${active.sub_target_type_set_id},${active.calc_option},${active.efficacy_type},${active.eff_val1},${active.eff_val2},${active.eff_val3},${active.thumb_effect_id},${active.effect_se_id},'${active.created_at}','${active.updated_at}');\n`
                    if (active.efficacy_type === 103) {
                        param_no.push(active.eff_val3)
                        let transfodesc = await query(`SELECT * FROM transformation_descriptions WHERE skill_id=${active.id}`,db_jap)
                        transfodesc = transfodesc[0]
                        SQLCode = SQLCode + `INSERT OR REPLACE INTO transformation_descriptions(id,skill_type,skill_id,description,created_at,updated_at) VALUES(${transfodesc.id},'ActiveSkill',${active.id},'${as_cond}','${transfodesc.created_at}','${transfodesc.updated_at}');\n`
                    }
                }
                if (activeSkillSet.ultimate_special_id !== null){
                    let ultimate_id_glo = await query(`SELECT * FROM ultimate_specials WHERE id=${activeSkillSet.ultimate_special_id}`,db_glo)
                    let ultimate_id_jap = await query(`SELECT * FROM ultimate_specials WHERE id=${activeSkillSet.ultimate_special_id}`,db_jap)
                    ultimate_id_jap = ultimate_id_jap[0]
                    if (ultimate_id_glo.length === 0){
                        SQLCode = SQLCode + `INSERT OR REPLACE INTO ultimate_specials(id,name,description,increase_rate,aim_target,created_at,updated_at) VALUES(${ultimate_id_jap.id},'${ultimate_id_jap.name}','${ultimate_id_jap.description}',${ultimate_id_jap.increase_rate},${ultimate_id_jap.aim_target},'${ultimate_id_jap.created_at}','${ultimate_id_jap.updated_at}');\n`
                    }
                }

    
    return {
        SQLCode,
        viewIDS,
        param_no
    }
        
}
async function importViews(array){
    let SQLCODE = ""
    for (let index = 0; index < array.length; index++) {
        const viewID = array[index];
        let jap_viewid = await query(`SELECT * FROM special_views WHERE id=${viewID}`,db_jap)
        jap_viewid = jap_viewid[0]
        SQLCODE = SQLCODE + `INSERT OR REPLACE INTO special_views(id,script_name,cut_in_card_id,special_name_no,special_motion,lite_flicker_rate,energy_color,special_category_id,created_at,updated_at) VALUES(${jap_viewid.id},'${jap_viewid.script_name}',${jap_viewid.cut_in_card_id},${jap_viewid.special_name_no},${jap_viewid.special_motion},${jap_viewid.lite_flicker_rate},${jap_viewid.energy_color},${jap_viewid.special_category_id},'${jap_viewid.created_at}','${jap_viewid.updated_at}');\n`
    }
    return SQLCODE
}
async function importChara(card,name){
    let SQLCODE = ""
    let character_glo = await query(`SELECT * FROM characters WHERE id=${card.character_id}`,db_glo)
    let character_jap = await query(`SELECT * FROM characters WHERE id=${card.character_id}`,db_jap)
    character_jap = character_jap[0]
    if (character_glo.length === 0){
            SQLCODE = SQLCODE + `INSERT OR REPLACE INTO characters(id,name,race,sex,size,created_at,updated_at) VALUES(${character_jap.id},'${name}',${character_jap.race},${character_jap.sex},${character_jap.size},'${character_jap.created_at}','${character_jap.updated_at}');\n` 
          
    }
    return SQLCODE
}
async function categorie(card){
    let SQLCode = ""
    let categories = await query(`SELECT * FROM card_card_categories WHERE card_id=${card.id}`,db_jap)
    for (let index = 0; index < categories.length; index++) {
        const category = categories[index];
        SQLCode = SQLCode + `INSERT OR REPLACE INTO card_card_categories(id,card_id,card_category_id,num,created_at,updated_at) VALUES(${category.id},${card.id},${category.card_category_id},${category.num},'${category.created_at}','${category.updated_at}');\n`      
    }
    return SQLCode
}
async function importUniqueInfos(card){
    let SQLCODE = ""
    let unikinfo_glo = await query(`SELECT * FROM card_unique_infos WHERE id=${card.card_unique_info_id}`,db_glo)
    let unikinfo_jap = await query(`SELECT * FROM card_unique_infos WHERE id=${card.card_unique_info_id}`,db_jap)
    unikinfo_jap = unikinfo_jap[0]
    if (unikinfo_glo.length === 0){
        SQLCODE = SQLCODE + `INSERT OR REPLACE INTO card_unique_infos(id,name,kana,created_at,updated_at) VALUES(${unikinfo_jap.id},'${unikinfo_jap.name}','${unikinfo_jap.kana}','${unikinfo_jap.created_at}','${unikinfo_jap.updated_at}');\n` 
        let unikinfo_relation= await query(`SELECT * FROM card_unique_info_set_relations WHERE card_unique_info_id=${unikinfo_jap.id}`,db_jap)
        for (let index = 0; index < unikinfo_relation.length; index++) {
            const unikinfon = unikinfo_relation[index];
            SQLCODE = SQLCODE + `INSERT OR REPLACE INTO card_unique_info_set_relations(id,card_unique_info_id,card_unique_info_set_id,created_at,updated_at) VALUES(${unikinfon.id},${unikinfon.card_unique_info_id},${unikinfon.card_unique_info_set_id},'${unikinfon.created_at}','${unikinfon.updated_at}');\n` 
        }
    }
    return SQLCODE
        
}
async function importBattle_params(param_no){
    let SQLCODE = ""
    for (let index = 0; index < param_no.length; index++) {
        const param_id = param_no[index];
        let battle_params = await query(`SELECT * FROM battle_params WHERE param_no=${param_id}`,db_jap)
        for (let index = 0; index < battle_params.length; index++) {
            const element = battle_params[index];
            SQLCODE = SQLCODE + `INSERT OR REPLACE INTO battle_params(id,param_no,idx,value,created_at,updated_at) VALUES(${element.id},${element.param_no},${element.idx},${element.value},'${element.created_at}','${element.updated_at}');\n`
        }             
    }
    return SQLCODE
}
async function importAwakRoutes(card){
    let SQLCode = ""
    let routes = await query(`SELECT * FROM card_awakening_routes WHERE card_id=${card.id}`,db_jap)
    for (let index = 0; index < routes.length; index++) {
        const element = routes[index];
        if (element.description !== null) element.description = `'${element.description}'`
        SQLCode = SQLCode + `INSERT OR REPLACE INTO card_awakening_routes(id,type,card_id,awaked_card_id,num,card_awakening_set_id,optimal_awakening_step,description,priority,open_at,created_at,updated_at) VALUES(${element.id},'${element.type}',${element.card_id},${element.awaked_card_id},${element.num},${element.card_awakening_set_id},${element.optimal_awakening_step},${element.description},${element.priority},'${element.open_at}','${element.created_at}','${element.updated_at}');\n`
        let awakenings = await query(`SELECT * FROM card_awakenings WHERE card_awakening_set_id=${element.card_awakening_set_id}`,db_jap)
        for (let index = 0; index < awakenings.length; index++) {
            const awaken = awakenings[index];
            SQLCode = SQLCode + `INSERT OR REPLACE INTO card_awakenings(id,num,awakening_item_id,quantity,card_awakening_set_id,created_at,updated_at) VALUES(${awaken.id},'${awaken.num}',${awaken.awakening_item_id},${awaken.quantity},${awaken.card_awakening_set_id},'${awaken.created_at}','${awaken.updated_at}');\n`
            
        }

    }
    return SQLCode
}
module.exports = {
    importPassive,
    importLeader,
    importSAs,
    importAS, 
    importViews,
    importChara,
    categorie,
    importUniqueInfos,
    importBattle_params,
    importAwakRoutes
}