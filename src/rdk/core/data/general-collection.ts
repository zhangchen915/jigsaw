import {
    IAjaxComponentData, DataReviser, DataRefreshCallback, ComponentDataHelper, CallbackRemoval, AjaxSuccessCallback,
    AjaxErrorCallback, AjaxCompleteCallback
} from "./component-data";
import {Http, RequestOptionsArgs, Response} from "@angular/http";

export abstract class AbstractGeneralCollection implements IAjaxComponentData {
    public http: Http;
    public busy: boolean;

    public abstract fromObject(data: any): AbstractGeneralCollection;

    protected abstract ajaxSuccessHandler(data): void;

    protected reviseData(response: Response): any {
        return this.wrappedDataReviser ? this.wrappedDataReviser(response.json()) : response.json();
    }

    public fromAjax(options: RequestOptionsArgs|string): void {
        if (!this.http) {
            console.error('set a valid Http instance to the http attribute before invoking fromAjax()!');
            return;
        }

        const op = ComponentDataHelper.castToRequestOptionsArgs(options);
        debugger
        this.http.request(op.url, op)
            .map(res => this.reviseData(res))
            .subscribe(
                data => this.ajaxSuccessHandler(data),
                error => this.ajaxErrorHandler(error),
                () => this.ajaxCompleteHandler()
            );
    }

    protected wrappedDataReviser: DataReviser;
    private _originDataReviser: DataReviser;

    public get dataReviser(): DataReviser {
        return this._originDataReviser;
    }

    public set dataReviser(value: DataReviser) {
        this._originDataReviser = value;
        this.wrappedDataReviser = (data) => {
            try {
                return this._originDataReviser(data);
            } catch (e) {
                console.error('revise data error: ' + e);
                console.error(e.stack);
                return data;
            }
        }
    }

    protected componentDataHelper: ComponentDataHelper = new ComponentDataHelper();

    public refresh(): void {
        this.componentDataHelper.invokeRefreshCallback();
    }

    public onRefresh(callback: (thisData: GeneralCollection) => void, context?: any): CallbackRemoval {
        return this.componentDataHelper.getRefreshRemoval({fn: callback, context: context});
    }

    public onAjaxSuccess(callback: (data: any) => void, context?: any): CallbackRemoval {
        return this.componentDataHelper.getAjaxSuccessRemoval({fn: callback, context: context});
    }

    public onAjaxError(callback: (error: Response) => void, context?: any): CallbackRemoval {
        return this.componentDataHelper.getAjaxErrorRemoval({fn: callback, context: context});
    }

    public onAjaxComplete(callback: () => void, context?: any): CallbackRemoval {
        return this.componentDataHelper.getAjaxCompleteRemoval({fn: callback, context: context});
    }

    protected ajaxErrorHandler(error): void {
        console.error('get data from paging server error!! detail: ' + error);
        this.componentDataHelper.invokeAjaxErrorCallback(error);
        this.busy = false;
    }

    protected ajaxCompleteHandler(): void {
        console.log('get data from paging server complete!!');
        this.componentDataHelper.invokeAjaxCompleteCallback();
        this.busy = false;
    }

    public destroy(): void {
        this.componentDataHelper.clearCallbacks();
        this.componentDataHelper = null;

        this.wrappedDataReviser = null;
        this._originDataReviser = null;
    }
}

export class GeneralCollection extends AbstractGeneralCollection {

    protected ajaxSuccessHandler(data): void {
        this.fromObject(data);
        this.componentDataHelper.invokeAjaxSuccessCallback(data);
    }

    protected propList: string[] = [];

    public fromObject(data: any): GeneralCollection {
        if (data instanceof GeneralCollection) {
            console.error("unable to make data from another GeneralCollection instance!");
            return;
        }

        let needRefresh = false;

        this.propList.forEach(prop => {
            needRefresh = true;
            delete this[prop];
        });
        this.propList.splice(0, this.propList.length);

        if (data) {
            for (let key in data) {
                if (!data.hasOwnProperty(key) || data[key] instanceof Function) {
                    continue;
                }
                needRefresh = true;
                this[key] = data[key];
                this.propList.push(key);
            }
        }

        if (needRefresh) {
            this.refresh();
        }

        return this;
    }

    public destroy(): void {
        super.destroy();
        console.log('destroying GeneralCollection....');

        this.propList.forEach((prop: string) => {
            delete this[prop];
        });
        this.propList.splice(0, this.propList.length);
    }
}
