import * as crypto from "crypto";
import { StringDecoder } from "string_decoder";

// Pad a number to 2 digits
const pad = (n : number) => `${Math.floor(Math.abs(n))}`.padStart(2, '0');
// Get timezone offset in ISO format (+hh:mm or -hh:mm)
const getTimezoneOffset = (date : Date) => {
  const tzOffset = -date.getTimezoneOffset();
  const diff = tzOffset >= 0 ? '+' : '-';
  return diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60);
};

export function toISOStringWithTimezone(date : Date) : string {
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    getTimezoneOffset(date);
};

interface SimplePayModeConfig {
    urlPrefix: string
}

export const SandboxModeConfig : SimplePayModeConfig= {
    urlPrefix: "https://sandbox.simplepay.hu/payment/v2/"
};

export const LiveModeConfig : SimplePayModeConfig = {
    urlPrefix: "https://secure.simplepay.hu/payment/v2/"
};

enum SimplePayLanguageCode {
    AR = "AR",
    BG = "BG",
    CS = "CS",
    DE = "DE",
    EN = "EN",
    ES = "ES",
    FR = "FR",
    IT = "IT",
    HR = "HR",
    HU = "HU",
    PL = "PL",
    RO = "RO",
    RU = "RU",
    SK = "SK",
    TR = "TR",
    ZH = "ZH"
}

interface InvoiceData {
    name: string,
    company: string,
    country: string,
    state: string,
    city: string,
    zip: string,
    address: string,
    address2: string,
    phone :string
}

interface SimplePayStartDataFull {
    salt: string,
    merchant: string,
    orderRef: string,
    currency: string,
    customerEmail: string,
    language: string,
    sdkVersion: string,

    methods: string[],
    total: string,
    timeout: string,
    url: string

    invoice: InvoiceData

}

export interface SimplePayStartData extends Partial<SimplePayStartDataFull> {}

interface SimplePayStartResponse {
    salt: string,
    merchant: string,
    orderRef: string,
    currency: string,
    transactionId: number,
    timeout: string,
    total: number,
    paymentUrl: string
}

interface SimplePayErrorResponse {
    errorCodes : number[]
}

interface MerchantData {
    merchant: string,
    secret: string
}

interface SimplePayRefundData {
    salt: string,
    orderRef?: string,
    transactionId? : number
    merchant: string,
    currency: string,
    refundTotal: number,
    sdkVersion: string
}

interface SimplePayRefundResponse {
    salt: string,
    merchant: string,
    orderRef: string,
    currency: string,
    transactionId: number,
    refundTransactionId: number,
    refundTotal: number,
    remainingTotal: number
}


interface SimplePayQueryData {
    merchant: string,
    detailed?: boolean,
    orderRefs? : string[],
    transactionIds? : string[],
    salt: string,
    sdkVersion: string
}

interface SimplePayQueryTransactionResponse {
    salt: string,
    merchant: string,
    orderRef: string,
    total: number,
    transactionId: number,
    status: string,
    remainingTotal: number,
    paymentDate: string,
    finishDate: string,
    method: string

}

interface SimplePayQueryResponse {
    salt: string,
    merchant: string,
    transactions: Partial<SimplePayQueryTransactionResponse>[],
    totalCount: number
}

interface SimplePayCancelTransactionData {
    salt: string,
    merchant: string,
    transactionId?: number,
    orderRef?: string,
    currency: string,
    sdkVersion: string
}

interface SimplePayCancelTransactionResponse {
    merchant: string,
    transactionId: number,
    orderRef: string,
    status: string,
    salt: string
}

export const SandboxUsers : MerchantData[] = [
    {merchant: "PUBLICTESTHUF", secret: "FxDa5w314kLlNseq2sKuVwaqZshZT5d6"},
    {merchant: "PUBLICTESTEUR", secret: "9A2sDc7xh1JKW8r193RwW7X7X2ts837w"},
    {merchant: "PUBLICTESTUSD", secret: "Aa9cDbHc1i2lLmN4z3C542zjXqZiDiCj"}
];


export function generateSignature(merchantKey : string, message : string) : string {
    let token = crypto.createHmac("sha384", merchantKey.trim())
    .update(message)
    .digest()
    .toString('base64');

    return token;
}

export function generateSalt() : string {
    return crypto.randomBytes(16).toString("hex");
}

// Human interfaces

abstract class SimplePayBaseTransaction {

    protected remote_url : string;

    protected merchant_data: MerchantData;

    protected transaction_data: any;

    protected response_data: any;

    public constructor(merchant: MerchantData, config: SimplePayModeConfig = LiveModeConfig) {
        this.merchant_data = merchant;
        this.remote_url = config.urlPrefix;
        this.init(config);
    }

    protected getSalt() : string {
        return generateSalt();
    }

    protected getSdkVersion() : string {
        return "js v2.1";
    }

    protected abstract init(config: SimplePayModeConfig) : void;

    public validate() : boolean {
        return true;
    }

    protected runTransaction() : Promise<any> {
        return new Promise((resolve, reject)=>{

            if(!this.validate()) reject(new Error("Validation failed"));

            let payload = JSON.stringify(this.transaction_data);
            let sign = generateSignature(this.merchant_data.secret, payload);

            fetch(this.remote_url, {method:"POST", body: payload, headers:{"Signature":sign, "Content-Type":"application/json"}}).then((resp)=>{
                resp.json().then(resolve, reject);
            },reject);

        });
    }
}


export class SimplePayStart extends SimplePayBaseTransaction {
    protected init(config: SimplePayModeConfig): void {
        this.remote_url = this.remote_url + "start";

        this.transaction_data = {
            salt: generateSalt(),
            merchant: this.merchant_data.merchant,
            currency: "HUF",
            language: "HU",
            sdkVersion: this.getSdkVersion(),
            total: "0",
            url: "http://localhost:8000/back"
        };

    }

    setTimeout(date: Date) {
        this.transaction_data.timeout = toISOStringWithTimezone(date);
    }

    setCustomerEmail(email : string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(emailRegex.test(email)) {
            this.transaction_data.customerEmail = email;
        }
        else throw new Error("Invalid email syntax");
    }

    setTotal(total : number) {
        this.transaction_data.total = total.toString();
    }

    setOrderRef(ref: string) {
        this.transaction_data.orderRef = ref;
    }

    card() : Promise<SimplePayStartResponse> {
        

        if(!this.transaction_data.methods) this.transaction_data.methods = ["CARD"];
        
        return this.runTransaction();
    }

}

export class SimplePayRefund extends SimplePayBaseTransaction {
    protected init(config: SimplePayModeConfig): void {
        this.remote_url = this.remote_url + "refund";

        this.transaction_data = {
            salt: this.getSalt(),
            orderRef: "",
            merchant: this.merchant_data.merchant,
            currency: "HUF",
            refundTotal: 0,
            sdkVersion: this.getSdkVersion()
        };
    }

    setOrderRef(orderRef: string) {
        this.transaction_data.orderRef = orderRef;
    }

    setRefundTotal(total: number) {
        if (total >= 0.0)
        this.transaction_data.refundTotal = total;
    }

    refund() : Promise<SimplePayRefundResponse> {
        return this.runTransaction();
    }

}

export class SimplePayCancelTransaction extends SimplePayBaseTransaction {
    protected init(config: SimplePayModeConfig): void {
        this.remote_url = this.remote_url + "transactioncancel";

        this.transaction_data = {
            salt: this.getSalt(),
            merchant: this.merchant_data.merchant,
            currency: "HUF",
            sdkVersion: this.getSdkVersion()
        };
    }

    setTransactionId(tid: number) {
        this.transaction_data.transactionId = tid;
        if (this.transaction_data.orderRef)
            this.transaction_data.orderRef = undefined;
    }

    setOrderRef(orderRef: string) {
        this.transaction_data.orderRef = orderRef;
        if (this.transaction_data.transactionId)
            this.transaction_data.transactionId = undefined;
    }

    public validate(): boolean {
        return this.transaction_data.transactionId || this.transaction_data.orderRef;
    }

    cancel() : Promise<SimplePayCancelTransactionResponse> {
        return this.runTransaction();
    }

}


export class SimplePayQuery extends SimplePayBaseTransaction {
    
    protected init(config: SimplePayModeConfig): void {
        this.remote_url = this.remote_url + "query"
        let bt : SimplePayQueryData = {
            merchant: this.merchant_data.merchant,
            salt: this.getSalt(),
            sdkVersion: this.getSdkVersion()
        };
        this.transaction_data = bt;
    }

    tranIDs : string[] = [];
    oredrRefs : string[] = [];

    addTransactionId(tid: string) {
        if(!this.tranIDs.includes(tid))
            this.tranIDs.push(tid);
    }

    addOrderRef(orf: string) {
        if(!this.oredrRefs.includes(orf))
            this.oredrRefs.push(orf);
    }

    getResponse() : SimplePayQueryResponse {
        return this.response_data;
    }

    public validate(): boolean {
        return this.transaction_data.orderRefs || this.transaction_data.transactionIds;
    }

    query(detailed: boolean = false) : Promise<SimplePayQueryResponse> {
        
        if (detailed)
            this.transaction_data.detailed = true;

        if (this.oredrRefs)
            this.transaction_data.orderRefs = this.oredrRefs;

        if (this.tranIDs)
            this.transaction_data.transactionIds = this.tranIDs;

        return this.runTransaction();
    }

}

