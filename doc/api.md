### 状态码定义：
```javascript
const InscriptionOpState = {
    OK: 0,

    ALREADY_EXISTS: 1,

    HASH_UNMATCHED: 2,

    // competition failed in same block
    COMPETITION_FAILED: 3,

    // amt is invalid
    INVALID_AMT: 4,

    // balance not enough
    INSUFFICIENT_BALANCE: 5,

    // hash not found
    HASH_NOT_FOUND: 6,

    // permission denied
    PERMISSION_DENIED: 7,

    // invalid params
    INVALID_PARAMS: 8,

    // invalid price
    INVALID_PRICE: 9,

    OUT_OF_RESONANCE_LIMIT: 10,

    HAS_NO_VALID_CHANT: 11,

    OUT_ADDRESS_IS_NOT_OWNER: 12,
};
```

### 接口

#### 根据公共数据hash获取铭文信息：

    /inscription/:hash

    GET

    参数：

    hash：公共数据hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",         // 如果err == 0，没有msg字段
        result: {               // 如果err != 0，没有result字段
            hash,               // 公共数据hash
            address,            // 铭文owner
            block_height,       // 创建区块高度
            timestamp,          // 创建时间
            text,               // 创建时写入的text
            price,              // 当前共鸣价格 string
            resonance_count     // 当前共鸣次数
        }
    }
    ```

#### 获取某地址拥有的铭文：

    /inscription_by_address/:address/:limit?/:offset?/:order?

    GET

    参数

    address：地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

#### 获取区块范围内的新增的铭文 [begin, end)：

    /inscription_by_block/:begin_block/:end_block?/:limit?/:offset?/:order?

    GET

    参数

    begin_block：起始区块

    end_block: 结束区块，0表示一直获取到最新的，默认为0

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

#### 获取铭文总数：

    /inscription_count

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: count
    }
    ```

#### 获取某数据的铭刻记录：

    /inscribe_by_hash/:hash/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash： 数据hash

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    inscription_id,         // string 铭文id
                    block_height,           // 所在区块
                    address,                // 铭刻地址
                    timestamp,              // 铭刻时间
                    txid,                   // 铭刻交易tx
                    content,                // 铭刻text
                    hash,                   // 公共数据hash
                    mint_amount,
                    service_charge,         // 手续费 string
                    text,
                    price,
                    hash_point,
                    hash_weight,
                    state                   //状态，状态码见统一说明
                }
            ]
        }
    }
    ```

#### 获取某地址的铭刻记录：

    /inscribe_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 查询地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list:               // item说明同上
        }
    }
    ```

#### 根据hash和地址获取铭刻记录：

    /inscribe_by_hash_address/:hash/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash: 数据hash

    address: 查询地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list:               // item说明同上
        }
    }
    ```

#### 根据交易hash获取铭刻记录：

    /inscribe_by_tx/:txid

    GET

    参数

    txid 交易hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: info        // 说明同上item
    }
    ```


### 获取某数据的共鸣记录：

    /resonance_by_hash/:hash/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash： 数据hash

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    hash,                   // 数据hash
                    inscription_id,         // 铭文id
                    address,                // 共鸣地址
                    content,                // 铭文内容
                    owner_bonus,            // 数据owner奖励 string
                    service_charge,         // 手续费 string
                    block_height,           // 共鸣区块
                    timestamp,              // 共鸣时间
                    txid,                   // transfer txid
                    stage,                  // 共鸣处于哪个阶段 'inscribe' or 'transfer'
                    genesis_block_height,   // reveal tx 块号
                    genesis_timestamp,      // reveal tx 时间
                    genesis_txid,           // reveal tx id
                    state,                  // 状态码，见统一说明
                }
            ]
        }
    }
    ```

#### 获取某地址的共鸣记录：

    /resonance_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

#### 根据hash和address获取共鸣记录：

    /resonance_by_hash_address/:hash/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash: 数据hash

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

#### 根据交易hash获取共鸣记录：

    /resonance_by_tx/:txid

    GET

    参数

    txid 交易hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: info        // 说明同上item
    }
    ```

### 获取某数据的吟唱记录：

    /chant_by_hash/:hash/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash: 数据hash

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    hash,               // 数据hash
                    inscription_id,     // 铭文id
                    content,            // 铭文内容
                    address,            // 吟唱发起人地址
                    block_height,       // 吟唱区块
                    timestamp,
                    user_bonus,         // 吟唱人奖励 string
                    owner_bonus,        // 数据owner奖励 string
                    txid,
                    hash_point,
                    hash_weight,
                    state,
                }
            ]
        }
    }
    ```

### 获取某数据的吟唱记录：

    /chant_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

### 根据hash和address获取吟唱记录：

    /chant_by_hash_address/:hash/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash: 数据hash

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    hash,               // 数据hash
                    inscription_id,     // 铭文id
                    content,            // 铭文内容
                    address,            // 吟唱发起人地址
                    block_height,       // 吟唱区块
                    timestamp,
                    user_bonus,         // 吟唱人奖励 string
                    owner_bonus,        // 数据owner奖励 string
                    txid,
                    hash_point,
                    hash_weight,
                    state,
                }
            ]
        }
    }
    ```

#### 根据交易hash获取吟唱记录：

    /chant_by_tx/:txid

    GET

    参数

    txid 交易hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: info        // 说明同上item
    }
    ```

#### 获取某数据的SetPrice记录：

    /set_price_by_hash/:hash/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash： 数据hash

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    inscription_id,         // string 铭文id
                    block_height,           // 所在区块
                    address,                // 发起地址
                    timestamp,              // 时间
                    txid,                   // 交易tx
                    content,                // 铭文内容
                    hash,                   // 公共数据hash
                    price,                  // string
                    hash_point,
                    hash_weight,
                    state                   //状态，状态码见统一说明
                }
            ]
        }
    }
    ```

#### 获取某地址的SetPrice记录：

    /set_price_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 查询地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list:               // item说明同上
        }
    }
    ```

#### 根据交易hash获取铭刻记录：

    /set_price_by_tx/:txid

    GET

    参数

    txid 交易hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: info        // 说明同上item
    }
    ```

#### 获取某地址的mint记录：

    /mint_record_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    inscription_id,     // mint id
                    content,            // 铭文内容
                    block_height,       // mint区块
                    timestamp,          // 时间
                    address,            // mint地址
                    amount,             // mint金额 string
                    lucky,              // 幸运字串
                    mint_type,          // int 0 -- 普通mint 1 -- 幸运mint
                    state,
                }
            ]
        }
    }
    ```

#### 获取幸运铭刻列表：

    /luck_mint/:limit?/:offset?/:order?

    GET

    参数

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上，再加上 txid
        }
    }
    ```

#### 获取过去24小时mint总量：

    /mint_last_24

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: totalAmount     // string
    }
    ```
    
#### 获取某地址余额：

    /balance/:address

    GET

    参数

    address: 返回的列表的长度限制，默认为0

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: balance     // string
    }
    ```

#### 获取当前index服务的同步状态：

    /indexer/state

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            eth_height,         // 已处理的eth的高度 int
            btc_height          // 已处理的btc的高度 int
        }
    }
    ```

#### 获取当前btc链最新的块号：

    /btc/block_height

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: height
    }
    ```

#### 获取btc链上某个交易详情：

    /btc/tx/:txid

    GET

    参数

    txid: 交易id

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: tx info
    }
    ```

#### 获取某地址在时间段内的收益：

    /income/:address/:begin_time/:end_time?

    GET

    参数

    begin_time: 起始时间（UTC）

    end_time: 结束时间，默认到当前时间

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            mint,               // mint部分 string
            chant_bonus,        // 吟唱奖励 string
            chanted_bonus,      // 被他人吟唱的奖励 string
            resonance_bonus     // 数据被共鸣的奖励 string
        }
    }
    ```

#### 根据地址获取转账记录

    /transfer_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 地址，无论是发起地址还是接受地址，都会返回

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            inscription_id,         // 铭文id
            stage,                  // 阶段
            genesis_block_height,   // reveal tx块号
            genesis_timestamp,      // reveal tx时间
            genesis_txid,           // reveal txid
            from_address,           // 发起地址
            content TEXT,           // 铭文内容
            block_height,           // 打包块号
            timestamp,              // 打包时间
            txid,                   // 打包交易
            to_address,             // 接收地址
            state                   // 转账状态
        }
    }
    ```  

#### 根据tx获取转账记录

    /transfer_by_tx/:txid

    GET

    参数

    txid: 交易id

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: 同上
    }
    ```  

#### 根据数据hash获取铭刻数据的转移记录

    /inscribe_data_transfer_by_hash/:hash/:limit?/:offset?/:state?/:order?

    GET

    参数

    hash: 数据hash

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            inscription_id,         // 铭文id
            hash,                   // 数据hash
            block_height,           // 块号
            timestamp,              // 时间
            txid,                   // 交易
            satpoint,               //
            from_address,           // 发起地址
            to_address,             // 接收地址
            value,                  // 金额
            state,                  // 状态
        }
    }
    ```  

#### 根据地址获取铭刻数据的转移记录

    /inscribe_data_transfer_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 地址，无论是发起地址还是接受地址，都会返回

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: 同上
    }
    ```  

#### 根据tx获取铭刻数据的转移记录

    /inscribe_data_transfer_by_tx/:txid

    GET

    参数

    txid: 交易id

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: 同上
    }
    ```  

#### 根据txid搜索：

    /search/:txid

    GET

    参数

    txid: 交易id

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            type,               // string
            ...                 // 其他数据参考上面对应数据
        }
    }
    ```  
    type的取值为下列其中一个，代表对应类型的交易:  
    mint            - mint  
    resonance       - 共鸣  
    chant           - 吟唱  
    transfer        - 转移  
    inscribe        - 铭刻  
    set_price       - 设置共鸣价格  
    data_transfer   - 转移数据所有权

#### 查询mint进度

    /mint_progress

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            total,              // string 总量
            service_charged,    // string 通过手续费返回mintpool的量
            pool_balance        // string mint pool余额
        }
    }
    ```

#### 根据地址查询用户操作

    /ops_by_address/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    address: 地址，无论是发起地址还是接受地址，都会返回

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    返回值中可能包含用户的操作类型（op）,取值有如下几种：  
    'mint'              - mint操作  
    'chant'             - 吟唱操作  
    'inscribe_data'     - 铭刻数据操作  
    'transfer_data'     - 转移数据操作  
    'inscribe_res'      - 铭刻共鸣操作  
    'res'               - 共鸣确认操作  
    'inscribe_transfer' - 铭刻transfer操作  
    'transfer'          - brc20转账操作  
    'set_price'         - 设置共鸣价格  

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            address,        // 用户地址
            inscription_id, // 相关铭文id
            block_height,   // 操作发生的区块
            timestamp,      // 时间
            txid,           // 操作txid
            op,             // string 操作类型 取值见op描述
            state,          // 见state描述
        }
    }
    ```    

#### 根据铭文id查询相关用户操作

    /ops_by_inscription/:inscription_id/:limit?/:offset?/:state?/:order?

    GET

    参数

    inscription_id: 铭文id

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            // 同上
        }
    }
    ```  

#### 根据铭文id和地址查询相关用户操作

    /ops_by_inscription_address/:inscription_id/:address/:limit?/:offset?/:state?/:order?

    GET

    参数

    inscription_id: 铭文id

    address: 用户地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    state: string类型，需要查询的记录状态 'success' or 'failed' or 'all'，默认 'all'

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            // 同上
        }
    }
    ```  

#### 根据铭文id和地址查询相关用户操作

    /ops_by_tx/:txid

    GET

    参数

    txid: 交易id

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            // 同上
        }
    }
    ```  

#### 根据地址查询共鸣关系（未验证，因为某些共鸣可能失效，这个接口返回的是未经验证的结果）

    /res_relation_by_address/:address

    GET

    参数

    address: 查询地址

    返回

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: [{
            address,            // 查询地址
            hash,               // 数据hash
            relation,           // int 关系，1代表共鸣
            inscription_id,     // 铭文id
            block_height,       // 关系建立的区块号
            timestamp,          // 关系建立的时间
        }]
    }
    ```

#### 根据hash查询共鸣关系（未验证，因为某些共鸣可能失效，这个接口返回的是未经验证的结果）

    /res_relation_by_hash/:hash

    GET

    参数

    hash: 数据hash

    返回

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: // 同上
    }
    ```

#### 根据地址查询共鸣关系（返回验证过的，确保有效的共鸣关系）

    /res_relation_by_address/verify/:address

    GET

    参数

    address: 查询地址

    返回

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: // 同上
    }
    ```

#### 根据hash查询共鸣关系（返回验证过的，确保有效的共鸣关系）

    /res_relation_by_hash/verify/:hash

    GET

    参数

    hash: 数据hash

    返回

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: // 同上
    }
    ```

#### 根据InscriptionId查询inscribe操作详情

    /inscription_op/:inscription_id

    GET

    参数

    inscription_id

    返回

    ```json
    {
        inscription_id,
        inscription_number,
        genesis_block_height,
        genesis_timestamp,
        genesis_satpoint,
        commit_txid,
        value,
        content,
        op: // string 可能的返回值有："mint", "transfer", "inscribe", "chant", "setPrice", "resonance"
        creator,
        owner,
        last_block_height,
        transfer_count,
        detail: // 根据op不同会返回不同的内容，详见以上各接口返回
    }
    ```

#### 根据hash查询hash weight

    /hash_weight/:hash

    GET

    参数

    hash: 公共数据hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            mixhash,
            timestamp,
            weight,
            point
        }
    }
    ```

#### 查询index同步详情

    /indexer/state_detail

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            version: "0.5.0",
            network: "testnet",
            genesis_block_height: 2570577,
            sync: {
                btc: 2572108,
                ord: 2572108,
                local: 2572108,
                percent: "100.00%"
            },
            index: {
                sync: 2572108,
                local: 2572108,
                percent: "100.00%"
            },
            eth: {
                eth: 39218,
                local: 39218,
                genesis_block_height: 1,
                percent: 100
            }
        }
    }
    ```